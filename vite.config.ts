import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    basicSsl(),
    {
      name: 'mpa-rewrite',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/minwa') {
            req.url = '/minwa/index.html';
          }
          next();
        });
      },
    },
  ],
  base: command === 'serve' ? '/' : (process.env.VITE_BASE_PATH || '/kotei-lens/'),
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        minwa: resolve(__dirname, 'minwa/index.html'),
      },
      output: {
        manualChunks: {
          'three': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          'vendor': ['react', 'react-dom', 'zustand']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['three', '@react-three/fiber', '@react-three/drei']
  }
}));