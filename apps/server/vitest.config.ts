import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // Compile decorators/DI metadata so Nest providers work under Vitest.
    swc.vite({
      module: { type: 'es6' },
    }),
  ],
  resolve: {
    alias: {
      '@voids/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
