import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', // Ensure relative paths for Electron
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/moonshot': {
            target: 'https://api.moonshot.cn/v1',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api\/moonshot/, ''),
          },
          '/api/ddg': {
            target: 'https://html.duckduckgo.com',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api\/ddg/, ''),
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('proxy error', err);
              });
            },
          },
          '/api/bing': {
            target: 'https://api.bing.microsoft.com',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api\/bing/, ''),
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': mode === 'development' ? JSON.stringify(env.MOONSHOT_API_KEY) : 'undefined',
        'process.env.MOONSHOT_API_KEY': mode === 'development' ? JSON.stringify(env.MOONSHOT_API_KEY) : 'undefined'
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-ui': ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge'],
              'vendor-charts': ['recharts'],
              'vendor-editor': ['react-quill-new'],
              'vendor-utils': ['date-fns', 'uuid', 'zod', 'zustand', 'crypto-js'],
              'vendor-openai': ['openai'],
            }
          }
        }
      }
    };
});
