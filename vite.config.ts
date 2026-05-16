import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiProxyTarget = process.env.VITE_BOVEDA_API_PROXY_TARGET ?? 'http://localhost:3000';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': apiProxyTarget,
      '/runtime': apiProxyTarget,
      '/demo/reset': apiProxyTarget,
      '/quotes': apiProxyTarget,
      '/risk': apiProxyTarget,
      '/loans': apiProxyTarget,
      '/events': apiProxyTarget,
      '/dashboard': apiProxyTarget
    }
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: false
  }
});
