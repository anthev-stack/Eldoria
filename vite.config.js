import { defineConfig } from 'vite';
import { resolve } from 'path';

const DYNMAP_TARGET = 'http://103.15.237.56:29165';

const proxy = {
  '/api': {
    target: 'http://localhost:3001',
    changeOrigin: true,
  },
  '/ws': {
    target: 'ws://localhost:3001',
    ws: true,
  },
  '/dynmap': {
    target: DYNMAP_TARGET,
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/dynmap/, ''),
    configure: (proxy) => {
      proxy.on('proxyReq', (proxyReq) => {
        // Dynmap's embedded server rejects large Cookie headers (HTTP 431).
        proxyReq.removeHeader('cookie');
      });
    },
  },
};

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
    },
  },
  server: { proxy },
  preview: { proxy },
});
