import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In development Vite serves the client on :5173 and proxies /api to the
// Express server on :4000. In production Express serves client/dist directly,
// so there is only ever one origin and no proxy is involved.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
