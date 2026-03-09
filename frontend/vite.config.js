import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';

const enableSourceMaps = process.env.VITE_SOURCEMAP === 'true';

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
    host: '127.0.0.1',
    open: false,

    // Proxy API requests to backend
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
      '/unity-builds': {
        target: 'http://127.0.0.1:9000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/unity-builds/, ''),
      }
    },

    // Enable CORS
    cors: true,

    // Watch options
    watch: {
      usePolling: false,
      ignored: [],
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
        virtualRide: resolve(__dirname, 'virtual-ride.html'),
        virtualRideUnity: resolve(__dirname, 'virtual-ride-unity.html'),
      },

      output: {
        // Manual chunks for better caching
        manualChunks: {
          // Core utilities
          'core': [
            './src/lib/core/api.js',
            './src/lib/core/state.js',
            './src/lib/core/eventBus.js',
            './src/lib/core/utils.js',
          ],
          'monitoring': [
            '@sentry/browser'
          ],
          'charts-vendor': [
            'chart.js/auto',
            'plotly.js-dist-min'
          ],
          'maps-vendor': [
            'mapbox-gl'
          ],
          'icons-motion': [
            'feather-icons',
            'framer-motion',
            'lucide-react'
          ],
          // Services
          'services': [
            './src/lib/services/DataService.js',
            './src/lib/services/AnalyticsService.js',
            './src/lib/services/InsightService.js',
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

    // Public production builds ship without source maps by default
    sourcemap: enableSourceMaps,

    // CSS code splitting
    cssCodeSplit: true,

    // Report compressed file size
    reportCompressedSize: true,

    // Chunk size warning limit (500kb)
    chunkSizeWarningLimit: 500,
  },

  // Optimization
  optimizeDeps: {
    // Keep discovery off, but force-prebundle core React deps so browser
    // never receives raw CJS files such as react-dom/client.js.
    noDiscovery: true,
    include: ['react', 'react-dom', 'react-dom/client', '@mapbox/polyline', 'mapbox-gl'],
  },

  // CSS configuration
  css: {
    devSourcemap: true,
    postcss: {
      plugins: [autoprefixer()]
    }
  },

  // Preview server (for testing production build)
  preview: {
    port: 8080,
    host: '127.0.0.1',
    open: false,
  },

  // Define global constants
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
});
