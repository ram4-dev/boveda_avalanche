import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/health': 'http://localhost:3000',
      '/quotes': 'http://localhost:3000',
      '/risk': 'http://localhost:3000',
      '/loans': 'http://localhost:3000',
      '/events': 'http://localhost:3000',
      '/dashboard': 'http://localhost:3000'
    }
  },
  build: {
    outDir: '../dist/web',
    emptyOutDir: false
  }
});
