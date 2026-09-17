import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
    proxy: { '/ws': { target: 'ws://127.0.0.1:3000', ws: true } },
  },
  build: { target: 'es2020', outDir: 'dist' },
});
