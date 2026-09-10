// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Public Supabase connection values, committed on purpose.
//
// The production build starts from a clean checkout, which has no .env file
// (.env is git-ignored and cannot be un-ignored from here). Without these the
// browser bundle is built with no Supabase URL/key and every page fails with
// "Missing Supabase environment variable(s)".
//
// These three values are public by design: the publishable (anon) key is meant
// to ship in the browser bundle, and access to data is enforced by row-level
// security policies, not by hiding this key. NEVER add SUPABASE_SERVICE_ROLE_KEY
// or any other server-only secret here — this file is bundled into client code.
const PUBLIC_SUPABASE = {
  VITE_SUPABASE_URL: "https://ifdgkjtfwimktgtgsyat.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_vewqQZkU11ewylJHzYKgwA_VlBu69KZ",
  VITE_SUPABASE_PROJECT_ID: "ifdgkjtfwimktgtgsyat",
} as const;

// Only fill in what the environment does not already provide, so a real .env
// (local dev, or any future pipeline-injected value) always wins.
const define = Object.fromEntries(
  Object.entries(PUBLIC_SUPABASE)
    .filter(([key]) => !process.env[key])
    .map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
);

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: { define },
});
