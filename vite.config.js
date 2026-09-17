import { defineConfig } from 'vite';

// Site 100% estático: sem backend, sem variáveis de ambiente, sem build server.
// Funciona igual em GitHub Pages, Vercel, Netlify, Cloudflare Pages e itch.io.
export default defineConfig({
  base: './',                       // caminhos relativos → funciona em subpasta (Pages)
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true },
  preview: { host: '0.0.0.0', port: 4173, allowedHosts: true },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
