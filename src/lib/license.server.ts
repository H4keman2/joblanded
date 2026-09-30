// Server-only Gumroad license checks. Never import this statically from
// client-reachable modules; load it with `await import()` inside handlers.
export type LicenseResult = { valid: boolean; reason?: string };

const MAX_DEVICES = 3;

async function checkWithGumroad(rawKey: string, increment: boolean): Promise<LicenseResult> {
  const licenseKey = rawKey.trim();
  if (licenseKey.length < 8) return { valid: false, reason: "That key doesn't look right." };

  const productId = process.env["GUMROAD_PRODUCT_ID"];
  if (!productId) return { valid: false, reason: "License verification is not configured." };

  let json: Record<string, unknown> = {};
  let ok = false;
  try {
    const res = await fetch("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_id: productId,
        license_key: licenseKey,
        increment_uses_count: increment ? "true" : "false",
      }).toString(),
    });
    ok = res.ok;
    json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  } catch (e) {
    console.error("Gumroad verify failed", e);
    return { valid: false, reason: "Couldn't reach the license server. Try again shortly." };
  }

  if (!ok || json["success"] !== true) return { valid: false, reason: "License key not recognized." };

  const purchase = (json["purchase"] ?? {}) as Record<string, unknown>;
  if (purchase["refunded"] === true || purchase["chargebacked"] === true)
    return { valid: false, reason: "This purchase was refunded." };
  if (purchase["subscription_cancelled_at"] || purchase["subscription_failed_at"])
    return { valid: false, reason: "This subscription is no longer active." };

  const uses = typeof json["uses"] === "number" ? json["uses"] : 0;
  if (uses > MAX_DEVICES)
    return {
      valid: false,
      reason: "This key has already been activated on the maximum of 3 devices.",
    };

  return { valid: true };
}

/** Activation check used by the verifyLicense server function. */
export async function verifyLicenseKey(licenseKey: string): Promise<LicenseResult> {
  const guard = await import("./license-guard.server");
  const key = licenseKey.trim();
  if (guard.isRateLimited())
    return { valid: false, reason: "Too many attempts. Please wait a few minutes." };
  const result = await checkWithGumroad(key, true);
  if (result.valid) guard.rememberVerified(key);
  return result;
}

/** Throws PRO_REQUIRED unless the key is currently valid. Does not increment uses. */
export async function requireValidLicense(licenseKey: string | null | undefined): Promise<void> {
  const key = (licenseKey ?? "").trim();
  if (key.length < 8) throw new Error("PRO_REQUIRED");
  const guard = await import("./license-guard.server");
  if (guard.isRecentlyVerified(key)) return;
  if (guard.isRateLimited()) throw new Error("PRO_REQUIRED");
  const result = await checkWithGumroad(key, false);
  if (!result.valid) throw new Error("PRO_REQUIRED");
  guard.rememberVerified(key);
}
