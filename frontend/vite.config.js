import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Root directory
  root: '.',

  // Public directory for static assets (favicon, etc)
  publicDir: 'public',

  // Base public path
  base: '/',

  // Development server configuration
  server: {
    port: 8080,
    host: true,
    open: true,

    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      }
    },

    // Enable CORS
    cors: true,

    // Watch options
    watch: {
      usePolling: false,
    }
  },

  // Build configuration
  build: {
    outDir: 'dist',
    assetsDir: 'assets',

    // Multi-page app configuration
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },

      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Core utilities
          'core': [
            './static/js/core/api.js',
            './static/js/core/state.js',
            './static/js/core/router.js',
            './static/js/core/eventBus.js',
          ],
          // Services
          'services': [
            './static/js/services/DataService.js',
            './static/js/services/AnalyticsService.js',
            './static/js/services/InsightService.js',
          ],
        },

        // Asset file names
        assetFileNames: (assetInfo) => {
          const fileName = assetInfo.names?.[0] || assetInfo.name || '';

          if (/\.(png|jpe?g|svg|gif|tiff|bmp|ico)$/i.test(fileName)) {
            return `assets/images/[name]-[hash][extname]`;
          }

          if (/\.css$/i.test(fileName)) {
            return `assets/css/[name]-[hash][extname]`;
          }

          if (/\.(woff2?|eot|ttf|otf)$/i.test(fileName)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }

          return `assets/[name]-[hash][extname]`;
        },

        // Chunk file names
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      }
    },

    // Target modern browsers
    target: 'es2020',

    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },

    // Source maps for debugging
    sourcemap: true,

    // CSS code splitting
    cssCodeSplit: true,

    // Report compressed file size
    reportCompressedSize: true,

    // Chunk size warning limit (500kb)
    chunkSizeWarningLimit: 500,
  },

  // Optimization
  optimizeDeps: {
    include: [
      // Add any dependencies that should be pre-bundled
    ],
  },

  // CSS configuration
  css: {
    devSourcemap: true,
  },

  // Preview server (for testing production build)
  preview: {
    port: 8080,
    host: true,
    open: true,
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
