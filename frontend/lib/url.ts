export function normalizeWebsiteInput(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  let candidate = trimmed
    .replace(/^https?:\/\//i, (match) => match.toLowerCase())
    .replace(/^https\/\//i, "https://")
    .replace(/^http\/\//i, "http://");

  if (candidate.startsWith("//")) {
    candidate = `https:${candidate}`;
  }

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    parsed.hostname = normalizeWebsiteHostname(parsed.hostname);

    if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
      return `${parsed.protocol}//${parsed.host}`;
    }

    return parsed.toString();
  } catch {
    return candidate;
  }
}

function normalizeWebsiteHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  const labels = normalized.split(".").filter(Boolean);

  if (normalized.startsWith("www.") || labels.length !== 2) {
    return normalized;
  }

  return `www.${normalized}`;
}
