import * as dns from "dns";
import { isIPv4, isIPv6 } from "net";

/**
 * SSRF guard for outgoing webhooks.
 *
 * Two checkpoints use this module:
 *  1. Create/update (synchronous, `checkWebhookUrl`): protocol must be http/https and, in
 *     production, the hostname must not be `localhost` or a literal private/reserved IP.
 *  2. Delivery (async, `checkWebhookTarget`): in production the hostname is resolved with
 *     `dns.promises.lookup(host, { all: true })` and EVERY returned address must be public.
 *
 * Remaining limitation (accepted, not solved here): DNS rebinding / TOCTOU. `fetch` performs
 * its own DNS resolution after our lookup, so a hostile DNS server with a very short TTL can
 * answer a public IP to us and a private IP to fetch. Closing this fully requires pinning the
 * resolved IP in a custom undici dispatcher (connect.lookup), which is out of scope.
 *
 * Outside production (development, test, e2e) private ranges are allowed so local webhook
 * receivers keep working; the protocol check still applies.
 */

export type WebhookUrlVerdict = { ok: true; url: URL } | { ok: false; reason: string };

export type WebhookTargetVerdict =
  | { ok: true }
  | { ok: false; blocked: true; reason: string }
  | { ok: false; blocked: false; reason: string };

export type HostLookup = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function isProductionEnv(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv === "production";
}

/** Strips IPv6 brackets and a trailing root dot, lowercases. */
export function normalizeHostname(hostname: string): string {
  let host = hostname.trim().toLowerCase();
  if (host.startsWith("[") && host.endsWith("]")) {
    host = host.slice(1, -1);
  }
  while (host.endsWith(".")) {
    host = host.slice(0, -1);
  }
  return host;
}

function parseIPv4(ip: string): number[] | null {
  if (!isIPv4(ip)) {
    return null;
  }
  return ip.split(".").map((part) => Number(part));
}

/** Parses an IPv6 address (optionally with embedded dotted IPv4 tail) into 16 bytes. */
function parseIPv6(input: string): number[] | null {
  // Drop a zone id such as fe80::1%eth0.
  const ip = input.split("%")[0];
  if (!isIPv6(ip)) {
    return null;
  }

  let head = ip;
  let tailBytes: number[] = [];
  const lastColon = ip.lastIndexOf(":");
  const maybeV4 = ip.slice(lastColon + 1);
  if (maybeV4.includes(".")) {
    const v4 = parseIPv4(maybeV4);
    if (!v4) {
      return null;
    }
    tailBytes = v4;
    head = ip.slice(0, lastColon + 1);
    // "::1.2.3.4" -> head "::"; "64:ff9b::1.2.3.4" -> head "64:ff9b::"; "::ffff:1.2.3.4" -> "::ffff:"
    if (head.endsWith(":") && !head.endsWith("::")) {
      head = head.slice(0, -1);
    }
  }

  const groupsNeeded = 8 - tailBytes.length / 2;
  let groups: string[];
  if (head.includes("::")) {
    const [left, right] = head.split("::");
    const leftGroups = left ? left.split(":") : [];
    const rightGroups = right ? right.split(":") : [];
    const fill = groupsNeeded - leftGroups.length - rightGroups.length;
    if (fill < 0) {
      return null;
    }
    groups = [...leftGroups, ...Array<string>(fill).fill("0"), ...rightGroups];
  } else {
    groups = head ? head.split(":") : [];
  }
  if (groups.length !== groupsNeeded) {
    return null;
  }

  const bytes: number[] = [];
  for (const group of groups) {
    const value = parseInt(group, 16);
    if (Number.isNaN(value) || value < 0 || value > 0xffff) {
      return null;
    }
    bytes.push(value >> 8, value & 0xff);
  }
  return [...bytes, ...tailBytes];
}

function inV4Range(bytes: number[], base: [number, number, number, number], prefix: number): boolean {
  let remaining = prefix;
  for (let i = 0; i < 4 && remaining > 0; i += 1) {
    const bits = Math.min(8, remaining);
    const mask = (0xff << (8 - bits)) & 0xff;
    if ((bytes[i] & mask) !== (base[i] & mask)) {
      return false;
    }
    remaining -= bits;
  }
  return true;
}

const BLOCKED_IPV4_RANGES: Array<[[number, number, number, number], number]> = [
  [[0, 0, 0, 0], 8], // "this network"
  [[10, 0, 0, 0], 8], // RFC1918
  [[100, 64, 0, 0], 10], // CGNAT
  [[127, 0, 0, 0], 8], // loopback
  [[169, 254, 0, 0], 16], // link-local, cloud metadata
  [[172, 16, 0, 0], 12], // RFC1918
  [[192, 0, 0, 0], 24], // IETF protocol assignments
  [[192, 0, 2, 0], 24], // TEST-NET-1
  [[192, 88, 99, 0], 24], // 6to4 relay anycast
  [[192, 168, 0, 0], 16], // RFC1918
  [[198, 18, 0, 0], 15], // benchmarking
  [[198, 51, 100, 0], 24], // TEST-NET-2
  [[203, 0, 113, 0], 24], // TEST-NET-3
  [[224, 0, 0, 0], 4], // multicast
  [[240, 0, 0, 0], 4] // reserved + broadcast
];

function isBlockedIPv4Bytes(bytes: number[]): boolean {
  return BLOCKED_IPV4_RANGES.some(([base, prefix]) => inV4Range(bytes, base, prefix));
}

function isBlockedIPv6Bytes(bytes: number[]): boolean {
  const allZero = (from: number, to: number) => bytes.slice(from, to).every((b) => b === 0);

  // ::/96 covers :: (unspecified), ::1 (loopback) and deprecated IPv4-compatible addresses.
  if (allZero(0, 12)) {
    return true;
  }
  // ::ffff:0:0/96 IPv4-mapped -> evaluate the embedded IPv4.
  if (allZero(0, 10) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return isBlockedIPv4Bytes(bytes.slice(12));
  }
  // 64:ff9b::/96 NAT64 -> evaluate the embedded IPv4.
  if (bytes[0] === 0x00 && bytes[1] === 0x64 && bytes[2] === 0xff && bytes[3] === 0x9b && allZero(4, 12)) {
    return isBlockedIPv4Bytes(bytes.slice(12));
  }
  // 2002::/16 6to4 -> evaluate the embedded IPv4 (bytes 2..5).
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isBlockedIPv4Bytes(bytes.slice(2, 6));
  }
  // 2001:db8::/32 documentation.
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) {
    return true;
  }
  // fc00::/7 unique-local.
  if ((bytes[0] & 0xfe) === 0xfc) {
    return true;
  }
  // fe80::/10 link-local and fec0::/10 deprecated site-local.
  if (bytes[0] === 0xfe && (bytes[1] & 0x80) === 0x80) {
    return true;
  }
  // ff00::/8 multicast.
  if (bytes[0] === 0xff) {
    return true;
  }
  return false;
}

/**
 * True when `ip` is a literal IP address in a loopback/private/link-local/reserved range.
 * Returns false for non-IP strings (hostnames).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const host = normalizeHostname(ip);
  const v4 = parseIPv4(host);
  if (v4) {
    return isBlockedIPv4Bytes(v4);
  }
  const v6 = parseIPv6(host);
  if (v6) {
    return isBlockedIPv6Bytes(v6);
  }
  return false;
}

function isLocalhostName(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost");
}

/**
 * Synchronous check used at create/update time and as the first step at delivery time.
 * The WHATWG URL parser already canonicalises decimal/hex/octal IPv4 forms
 * (e.g. http://2130706433/ and http://0x7f.1/ become 127.0.0.1), so the literal check
 * sees the normalised dotted form.
 */
export function checkWebhookUrl(rawUrl: string, production: boolean = isProductionEnv()): WebhookUrlVerdict {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "Webhook URL không hợp lệ" };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "Webhook URL chỉ được dùng giao thức http hoặc https" };
  }

  if (production) {
    const host = normalizeHostname(url.hostname);
    if (!host) {
      return { ok: false, reason: "Webhook URL không hợp lệ" };
    }
    if (isLocalhostName(host)) {
      return { ok: false, reason: "Webhook URL không được trỏ tới localhost" };
    }
    if (isPrivateOrReservedIp(host)) {
      return { ok: false, reason: "Webhook URL không được trỏ tới địa chỉ IP nội bộ hoặc dành riêng" };
    }
  }

  return { ok: true, url };
}

const defaultLookup: HostLookup = (hostname) => dns.promises.lookup(hostname, { all: true });

/**
 * Full check at delivery time. In production, resolves the hostname and rejects if ANY
 * resolved address is private/reserved (an attacker controlling DNS could otherwise mix one
 * public and one private record). `blocked: true` means retrying is pointless; `blocked: false`
 * is a transient failure (e.g. DNS lookup error) that may be retried.
 * See the module comment for the DNS-rebinding limitation.
 */
export async function checkWebhookTarget(
  rawUrl: string,
  production: boolean = isProductionEnv(),
  lookup: HostLookup = defaultLookup
): Promise<WebhookTargetVerdict> {
  const verdict = checkWebhookUrl(rawUrl, production);
  if (!verdict.ok) {
    return { ok: false, blocked: true, reason: verdict.reason };
  }
  if (!production) {
    return { ok: true };
  }

  const host = normalizeHostname(verdict.url.hostname);
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(host);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, blocked: false, reason: `Không phân giải được tên miền webhook: ${detail}` };
  }

  if (addresses.length === 0) {
    return { ok: false, blocked: false, reason: "Không phân giải được tên miền webhook" };
  }

  const privateAddress = addresses.find((entry) => isPrivateOrReservedIp(entry.address));
  if (privateAddress) {
    return {
      ok: false,
      blocked: true,
      reason: `Webhook URL phân giải tới địa chỉ nội bộ hoặc dành riêng (${privateAddress.address})`
    };
  }

  return { ok: true };
}
