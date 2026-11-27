// Path the app first loaded at in this page session, captured at module
// evaluation. This module must stay imported from the first bundle
// (src/routes/__root.tsx imports it for its side effect) so the value is the
// cold-start URL, not the URL of a later lazy route-chunk load. The
// Quick-save route uses it to tell a home-screen launch — the app
// cold-started straight at /save, because the installed PWA still carries
// the old start_url — apart from in-app navigation to /save, which must keep
// working.
export const launchPath = typeof window === "undefined" ? "" : window.location.pathname;
