import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Mounted at /react/ behind dev-proxy so all three UIs share one origin (and therefore
  // one localStorage, which is what lets the session survive a framework switch).
  base: '/react/',
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 4400,
    // Mirrors the Angular app's proxy.conf.json so `/api` reaches FastAPI in dev.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    },
  },
});
