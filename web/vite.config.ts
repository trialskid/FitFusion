import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const proxyTarget = process.env.VITE_API_PROXY || 'http://localhost:3001';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/merge': {
        target: proxyTarget,
        changeOrigin: true
      },
      '/inspect': {
        target: proxyTarget,
        changeOrigin: true
      }
    }
  }
});
