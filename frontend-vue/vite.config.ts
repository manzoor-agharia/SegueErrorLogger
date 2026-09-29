import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  // Mounted at /vue/ behind dev-proxy so all three UIs share one origin (and therefore
  // one localStorage, which is what lets the session survive a framework switch).
  base: '/vue/',
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 4300,
    // Mirrors the Angular app's proxy.conf.json so `/api` reaches FastAPI in dev.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true, secure: false },
    },
  },
});
