import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `BASE_URL` build arg supports sub-path mounting (parity with Gaps). Default '/'.
const base = process.env.BASE_URL ?? '/';

// Single source of truth for the displayed version: the release script derives it
// from the git tag and passes it in via APP_VERSION. When unset (local `vite dev`
// or ad-hoc builds) fall back to package.json with a `-dev` suffix so it's obvious
// the build wasn't cut from a tag.
const pkgVersion = (
  JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string }
).version;
const appVersion = process.env.APP_VERSION ?? `${pkgVersion}-dev`;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Resolve the shared package to source so HMR works against it in dev.
      '@voids/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8484', changeOrigin: true },
      '/ws': { target: 'http://localhost:8484', ws: true, changeOrigin: true },
    },
  },
});
