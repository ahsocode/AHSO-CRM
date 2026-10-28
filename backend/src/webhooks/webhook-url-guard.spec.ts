import {
  checkWebhookTarget,
  checkWebhookUrl,
  HostLookup,
  isPrivateOrReservedIp
} from "./webhook-url-guard";

describe("isPrivateOrReservedIp", () => {
  it.each([
    ["127.0.0.1"],
    ["127.255.255.254"],
    ["10.0.0.1"],
    ["10.255.255.255"],
    ["172.16.0.1"],
    ["172.31.255.255"],
    ["192.168.1.10"],
    ["169.254.169.254"],
    ["100.64.0.1"],
    ["100.127.255.255"],
    ["0.0.0.0"],
    ["0.1.2.3"],
    ["224.0.0.1"],
    ["239.255.255.250"],
    ["240.0.0.1"],
    ["255.255.255.255"],
    ["192.0.2.5"],
    ["198.18.0.1"],
    ["::1"],
    ["::"],
    ["[::1]"],
    ["fe80::1"],
    ["febf::1"],
    ["fc00::1"],
    ["fd12:3456:789a::1"],
    ["ff02::1"],
    ["::ffff:127.0.0.1"],
    ["::ffff:10.0.0.1"],
    ["::ffff:169.254.169.254"],
    ["::ffff:7f00:1"],
    ["[::ffff:192.168.0.1]"],
    ["64:ff9b::a00:1"],
    ["2002:7f00:1::"],
    ["2001:db8::1"]
  ])("blocks %s", (ip) => {
    expect(isPrivateOrReservedIp(ip)).toBe(true);
  });

  it.each([
    ["8.8.8.8"],
    ["1.1.1.1"],
    ["172.15.255.255"],
    ["172.32.0.1"],
    ["100.63.255.255"],
    ["100.128.0.1"],
    ["169.253.0.1"],
    ["11.0.0.1"],
    ["2606:4700:4700::1111"],
    ["::ffff:8.8.8.8"],
    ["2400:cb00::1"],
    ["example.com"],
    ["localhost"]
  ])("allows %s", (ip) => {
    expect(isPrivateOrReservedIp(ip)).toBe(false);
  });
});

describe("checkWebhookUrl", () => {
  describe("production", () => {
    it.each([
      ["https://example.com/hook"],
      ["http://example.com:8080/hook"],
      ["https://8.8.8.8/hook"],
      ["https://[2606:4700:4700::1111]/hook"]
    ])("accepts public %s", (url) => {
      expect(checkWebhookUrl(url, true).ok).toBe(true);
    });

    it.each([
      ["http://localhost:3001/api"],
      ["http://LOCALHOST./api"],
      ["http://api.localhost/x"],
      ["http://127.0.0.1/"],
      ["http://10.1.2.3/"],
      ["http://172.20.0.5:5432/"],
      ["http://192.168.0.1/"],
      ["http://169.254.169.254/latest/meta-data/"],
      ["http://100.64.1.1/"],
      ["http://0.0.0.0:6379/"],
      ["http://224.0.0.1/"],
      ["http://[::1]/"],
      ["http://[fe80::1]/"],
      ["http://[fd00::1]/"],
      ["http://[::ffff:127.0.0.1]/"],
      ["http://[::ffff:a9fe:a9fe]/"],
      // Non-dotted IPv4 forms normalised by the WHATWG URL parser.
      ["http://2130706433/"],
      ["http://0x7f000001/"],
      ["http://0177.0.0.1/"],
      ["http://0x7f.1/"],
      ["http://127.1/"]
    ])("rejects internal %s", (url) => {
      const verdict = checkWebhookUrl(url, true);
      expect(verdict.ok).toBe(false);
    });

    it.each([["file:///etc/passwd"], ["ftp://example.com/x"], ["gopher://example.com/"], ["javascript:alert(1)"]])(
      "rejects protocol %s",
      (url) => {
        const verdict = checkWebhookUrl(url, true);
        expect(verdict).toEqual({ ok: false, reason: "Webhook URL chỉ được dùng giao thức http hoặc https" });
      }
    );

    it("rejects unparsable URL", () => {
      expect(checkWebhookUrl("not a url", true)).toEqual({ ok: false, reason: "Webhook URL không hợp lệ" });
    });
  });

  describe("non-production", () => {
    it.each([
      ["http://localhost:3001/api"],
      ["http://127.0.0.1:4000/"],
      ["http://192.168.1.5/"],
      ["http://[::1]:3000/"],
      ["https://example.com/hook"]
    ])("allows %s", (url) => {
      expect(checkWebhookUrl(url, false).ok).toBe(true);
    });

    it.each([["file:///etc/passwd"], ["ftp://localhost/x"]])("still rejects protocol %s", (url) => {
      expect(checkWebhookUrl(url, false).ok).toBe(false);
    });
  });

  it("uses NODE_ENV when production flag is omitted", () => {
    const original = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      expect(checkWebhookUrl("http://127.0.0.1/").ok).toBe(false);
      process.env.NODE_ENV = "test";
      expect(checkWebhookUrl("http://127.0.0.1/").ok).toBe(true);
    } finally {
      process.env.NODE_ENV = original;
    }
  });
});

describe("checkWebhookTarget", () => {
  const lookupReturning = (...addresses: string[]): jest.MockedFunction<HostLookup> =>
    jest.fn(async (_hostname: string) => addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));

  it("accepts a hostname resolving only to public addresses", async () => {
    const lookup = lookupReturning("93.184.216.34", "2606:2800:220:1::1");
    await expect(checkWebhookTarget("https://example.com/hook", true, lookup)).resolves.toEqual({ ok: true });
    expect(lookup).toHaveBeenCalledWith("example.com");
  });

  it("blocks when ANY resolved address is private", async () => {
    const lookup = lookupReturning("93.184.216.34", "10.0.0.5");
    const verdict = await checkWebhookTarget("https://evil.example/hook", true, lookup);
    expect(verdict).toMatchObject({ ok: false, blocked: true });
  });

  it("blocks IPv4-mapped IPv6 resolution results", async () => {
    const lookup = lookupReturning("::ffff:169.254.169.254");
    const verdict = await checkWebhookTarget("https://evil.example/hook", true, lookup);
    expect(verdict).toMatchObject({ ok: false, blocked: true });
  });

  it("blocks literal internal URL without DNS lookup", async () => {
    const lookup = lookupReturning("8.8.8.8");
    const verdict = await checkWebhookTarget("http://127.0.0.1/", true, lookup);
    expect(verdict).toMatchObject({ ok: false, blocked: true });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("reports DNS failure as non-blocking (retryable)", async () => {
    const lookup: jest.MockedFunction<HostLookup> = jest.fn(async (_hostname: string) => {
      throw new Error("ENOTFOUND");
    });
    const verdict = await checkWebhookTarget("https://example.com/hook", true, lookup);
    expect(verdict).toMatchObject({ ok: false, blocked: false });
  });

  it("skips DNS checks outside production", async () => {
    const lookup = lookupReturning("10.0.0.5");
    await expect(checkWebhookTarget("http://localhost:3001/", false, lookup)).resolves.toEqual({ ok: true });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("still rejects non-http protocol outside production", async () => {
    const verdict = await checkWebhookTarget("file:///etc/passwd", false, lookupReturning());
    expect(verdict).toMatchObject({ ok: false, blocked: true });
  });
});
