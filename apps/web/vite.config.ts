import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `BASE_URL` build arg supports sub-path mounting (parity with Gaps). Default '/'.
const base = process.env.BASE_URL ?? '/';

export default defineConfig({
  base,
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
