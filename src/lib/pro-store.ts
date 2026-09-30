import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { verifyLicense } from "@/lib/license.functions";

// UI convenience only — gated server functions re-verify the key.
const KEY = "joblanded.license.v1";
const VERIFIED_AT = "joblanded.license.verified-at.v1";
const RECHECK_MS = 12 * 60 * 60_000;
const EVENT = "joblanded-license-change";

function read() {
  if (typeof window === "undefined") return { key: null as string | null, at: 0 };
  return {
    key: localStorage.getItem(KEY),
    at: Number(localStorage.getItem(VERIFIED_AT) ?? 0) || 0,
  };
}

export function isProRequired(e: unknown) {
  return e instanceof Error && e.message.includes("PRO_REQUIRED");
}

export function toastProError(e: Error) {
  if (isProRequired(e)) {
    toast.error("This is a JobLanded Pro feature.", {
      action: { label: "Get Pro", onClick: () => (window.location.href = "/pro") },
    });
  } else toast.error(e.message);
}

export function usePro() {
  const verify = useServerFn(verifyLicense);
  const [key, setKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setKey(read().key);
    sync();
    setLoaded(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const { key: stored, at } = read();
    if (!stored || Date.now() - at < RECHECK_MS) return;
    localStorage.setItem(VERIFIED_AT, String(Date.now())); // avoid parallel rechecks
    verify({ data: { licenseKey: stored } })
      .then((r) => {
        if (!r.valid) {
          localStorage.removeItem(KEY);
          localStorage.removeItem(VERIFIED_AT);
          window.dispatchEvent(new Event(EVENT));
        }
      })
      .catch(() => undefined);
  }, [verify]);

  const activate = useCallback(
    async (raw: string) => {
      const licenseKey = raw.trim();
      setChecking(true);
      setError(null);
      try {
        const r = await verify({ data: { licenseKey } });
        if (!r.valid) {
          setError(r.reason ?? "License key not recognized.");
          return false;
        }
        localStorage.setItem(KEY, licenseKey);
        localStorage.setItem(VERIFIED_AT, String(Date.now()));
        window.dispatchEvent(new Event(EVENT));
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Verification failed.");
        return false;
      } finally {
        setChecking(false);
      }
    },
    [verify],
  );

  const deactivate = useCallback(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem(VERIFIED_AT);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { isPro: !!key, key, activate, deactivate, loaded, checking, error };
}
