import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const API_TARGET = 'http://localhost:5000';

/** When the API is down, avoid a blank Chrome error — show a short HTML hint. */
function proxyToBackend() {
  return {
    target:       API_TARGET,
    changeOrigin: true,
    configure(proxy) {
      proxy.on('error', (err, _req, res) => {
        if (!res || res.writableEnded || res.headersSent) return;
        const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const detail = err?.code === 'ECONNREFUSED'
          ? 'Nothing is listening on port 5000. From <code>jobhunter-backend</code> run <code>npm run dev</code> (needs a working <code>MONGODB_URI</code>), or use <code>npm run dev:local</code> for an in-memory Mongo dev DB when Atlas/DNS fails.'
          : esc(err?.message || err || 'Proxy error');
        res.writeHead(503, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>API unavailable</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;line-height:1.5">
<h1 style="font-size:1.25rem">Cannot reach the API (${API_TARGET})</h1>
<p>${detail}</p>
<p><a href="/">← Open app</a></p>
</body></html>`);
      });
    },
  };
}

export default defineConfig({
  // Keep prebundle cache outside synced/heavy trees when possible (avoids half-written chunks on Windows).
  cacheDir: path.resolve(__dirname, '.vite'),
  plugins: [react()],
  build: {
    // Saves memory during `vite build` (important on Render / small CI runners)
    reportCompressedSize: false,
    sourcemap:            false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  resolve: {
    alias: {
      '@':           path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages':      path.resolve(__dirname, './src/pages'),
      '@hooks':      path.resolve(__dirname, './src/hooks'),
      '@utils':      path.resolve(__dirname, './src/utils'),
      '@store':      path.resolve(__dirname, './src/store'),
      '@context':    path.resolve(__dirname, './src/context'),
      '@styles':     path.resolve(__dirname, './src/styles'),
    },
  },
  server: {
    port:       3000,
    strictPort: true,
    proxy: {
      '/api':        proxyToBackend(),
      '/socket.io': { ...proxyToBackend(), ws: true },
    },
  },
});