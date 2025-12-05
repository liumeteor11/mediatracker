import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', // Ensure relative paths for Electron
      server: {
        port: 2333,
        host: '0.0.0.0',
        proxy: {
          '/api/moonshot': {
            target: 'https://api.moonshot.cn',
            changeOrigin: true,
            secure: false,
            rewrite: (path) => path.replace(/^\/api\/moonshot/, ''),
            configure: (proxy, _options) => {
              proxy.on('error', (err, _req, _res) => {
                console.log('proxy error', err);
              });
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                console.log('Sending Request to the Target:', req.method, req.url);
              });
              proxy.on('proxyRes', (proxyRes, req, _res) => {
                console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
              });
            },
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
              proxy.on('proxyReq', (proxyReq, req, _res) => {
                proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                proxyReq.setHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8');
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
              'vendor-utils': ['date-fns', 'uuid', 'zod', 'zustand', 'crypto-js'],
              'vendor-openai': ['openai'],
            }
          }
        }
      }
    };
});
