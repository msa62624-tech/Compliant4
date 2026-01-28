import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001', changeOrigin: true },
      '/auth': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001', changeOrigin: true },
      '/entities': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001', changeOrigin: true },
      '/public': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001', changeOrigin: true },
      '/integrations': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:3001', changeOrigin: true }
    },
    hmr: process.env.CODESPACE_NAME
      ? {
          protocol: 'wss',
          host: `${process.env.CODESPACE_NAME}-5175.app.github.dev`,
          clientPort: 443
        }
      : undefined
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
        '.ts': 'tsx',
      },
    },
  },
}) 