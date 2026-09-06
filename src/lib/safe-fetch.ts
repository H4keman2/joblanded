// Guards outbound fetches of a *user-supplied* URL (e.g. a pasted job-posting
// link) against SSRF: without this, a user could point the server at cloud
// instance metadata, an internal admin panel, or any other host/port reachable
// from wherever this app runs, and have the response fetched, scraped and
// handed back to them.
//
// What this checks, on the initial URL and again on every redirect hop:
//   - scheme is http/https only (no file:, data:, gopher:, etc.)
//   - the literal hostname/IP isn't loopback, link-local, RFC1918 private,
//     CGNAT, or a well-known "localhost"/metadata alias
//
// Caveat: this app runs on a Cloudflare Worker runtime with no DNS-resolution
// API available, so this checks the literal host in the URL rather than the
// IP it eventually resolves to. It does not defend against DNS rebinding (a
// hostname that resolves to a public IP now and a private one at fetch time).
// That's a narrower attack than the "just type the internal IP" case this
// closes, and re-validating on every redirect hop closes the other common
// bypass (a public URL that 302s to an internal one).
export class UnsafeUrlError extends Error {}

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^127\./, // loopback
  /^10\./, // RFC1918
  /^192\.168\./, // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./, // RFC1918 172.16.0.0/12
  /^169\.254\./, // link-local, incl. 169.254.169.254 cloud metadata
  /^0\./, // "this" network
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64.0.0/10
];

function isPrivateIPv4(host: string): boolean {
  return PRIVATE_IPV4_PATTERNS.some((re) => re.test(host));
}

function isPrivateIPv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("fc") || h.startsWith("fd")) return true; // unique local fc00::/7
  if (h.startsWith("fe8") || h.startsWith("fe9") || h.startsWith("fea") || h.startsWith("feb"))
    return true; // link-local fe80::/10
  if (h.startsWith("::ffff:")) return isPrivateIPv4(h.slice(7));
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "metadata" || host === "metadata.google.internal") return true;
  if (host.includes(":")) return isPrivateIPv6(host);
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPrivateIPv4(host);
  return false;
}

function assertSafeUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only http and https URLs are supported.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new UnsafeUrlError("That URL points at a location this app can't fetch.");
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2_000_000; // generous for a job-posting page

export interface SafeFetchResult {
  status: number;
  ok: boolean;
  /** Reads the body, capped at MAX_RESPONSE_BYTES and decoded as UTF-8 text. */
  text: () => Promise<string>;
}

/**
 * Fetches a user-supplied URL with SSRF guards: scheme + private-range
 * checks (re-applied on every redirect), a request timeout, and a response
 * size cap so a huge or slow response can't tie up the server function.
 */
export async function fetchPublicUrl(
  inputUrl: string,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<SafeFetchResult> {
  let current: URL;
  try {
    current = new URL(inputUrl);
  } catch {
    throw new UnsafeUrlError("That doesn't look like a valid URL.");
  }
  assertSafeUrl(current);

  for (let redirects = 0; ; redirects++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        headers: init.headers,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("That page took too long to respond.");
      }
      throw new Error("Could not reach that URL.");
    } finally {
      clearTimeout(timer);
    }

    const isRedirect = res.status >= 300 && res.status < 400;
    const location = isRedirect ? res.headers.get("location") : null;
    if (isRedirect && location) {
      if (redirects >= MAX_REDIRECTS) throw new Error("Too many redirects.");
      current = new URL(location, current);
      assertSafeUrl(current);
      continue;
    }

    return wrapResponse(res);
  }
}

function wrapResponse(res: Response): SafeFetchResult {
  return {
    status: res.status,
    ok: res.ok,
    text: () => readCapped(res),
  };
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return res.text();

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total < MAX_RESPONSE_BYTES) chunks.push(value);
    total += value.byteLength;
    if (total >= MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      break;
    }
  }

  const size = Math.min(total, MAX_RESPONSE_BYTES);
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = buffer.length - offset;
    if (remaining <= 0) break;
    const slice = chunk.subarray(0, remaining);
    buffer.set(slice, offset);
    offset += slice.length;
  }
  return new TextDecoder().decode(buffer);
}
