import { getRequestIP } from "@tanstack/react-start/server";

const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;
const VERIFIED_TTL_MS = 5 * 60_000;

const attempts = new Map<string, number[]>();
const verified = new Map<string, number>();

/** In-memory per-IP sliding window: max 8 verification attempts per 10 minutes. */
export function isRateLimited(): boolean {
  let ip = "unknown";
  try {
    ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
  } catch {
    // no request context
  }
  const now = Date.now();
  const recent = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(ip, recent);
    return true;
  }
  recent.push(now);
  attempts.set(ip, recent);
  return false;
}

export function isRecentlyVerified(key: string): boolean {
  const at = verified.get(key);
  if (!at) return false;
  if (Date.now() - at > VERIFIED_TTL_MS) {
    verified.delete(key);
    return false;
  }
  return true;
}

export function rememberVerified(key: string): void {
  verified.set(key, Date.now());
}
