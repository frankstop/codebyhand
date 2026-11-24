import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/curriculum/js/')) return 'curriculum-js';
          if (id.includes('/src/curriculum/rust/')) return 'curriculum-rust';
          if (id.includes('/src/curriculum/cobol/')) return 'curriculum-cobol';
          if (id.includes('@codemirror/') || id.includes('@lezer/') || id.includes('/node_modules/codemirror/')) {
            return 'codemirror';
          }
          if (id.includes('/node_modules/react') || id.includes('/node_modules/lucide-react')) {
            return 'vendor-ui';
          }
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@live-codes/cobol-wasm'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
