import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// Proxy /api to the NestJS API so the web app stays same-origin:
// HttpOnly client cookie and SSE work without cross-origin friction.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Consume the shared package's TS source directly. esbuild handles the
      // enum's named export cleanly (the CJS dist trips up rollup detection).
      '@queue/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
