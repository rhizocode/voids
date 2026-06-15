/// <reference types="vite/client" />

// Injected at build time by Vite's `define` (see vite.config.ts). Derived from the
// git tag via the release script; falls back to `<pkg>-dev` for untagged builds.
declare const __APP_VERSION__: string;
