import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { resolve } from 'path';

function robotsMeta(): Plugin {
  const allowIndexing = process.env.VITE_ALLOW_INDEXING === 'true';
  return {
    name: 'robots-meta',
    transformIndexHtml(html) {
      const tag = allowIndexing
        ? '<meta name="robots" content="index, follow" />'
        : '<meta name="robots" content="noindex, nofollow" />';
      return html.replace('<!-- __ROBOTS_META__ -->', tag);
    },
    generateBundle() {
      const content = allowIndexing
        ? 'User-agent: *\nAllow: /\n'
        : 'User-agent: *\nDisallow: /\n';
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: content,
      });
    },
  };
}

function googleAnalytics(): Plugin {
  const measurementId = process.env.VITE_GA_MEASUREMENT_ID;
  return {
    name: 'google-analytics',
    transformIndexHtml(html) {
      if (!measurementId) {
        return html.replace('<!-- __GA_SCRIPT__ -->', '');
      }
      const gaSnippet = `<script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
    <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${measurementId}');</script>`;
      return html.replace('<!-- __GA_SCRIPT__ -->', gaSnippet);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    basicSsl(),
    robotsMeta(),
    googleAnalytics(),
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