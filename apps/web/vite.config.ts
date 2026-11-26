import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

/** Where the API runs in development. The dev server proxies to it (no CORS needed). */
const API_URL = process.env['MINEFALL_API_URL'] ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    port: Number(process.env['MINEFALL_WEB_PORT'] ?? 5173),
    proxy: {
      '/auth': API_URL,
      '/health': API_URL,
      '/me': API_URL,
      '/socket.io': { target: API_URL, ws: true },
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.spec.ts'],
  },
});
