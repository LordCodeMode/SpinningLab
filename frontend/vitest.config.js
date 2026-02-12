import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['**/*.{test,spec}.js'],
    exclude: ['node_modules', 'dist', 'build'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '*.config.js',
        '*.config.cjs',
        'src/main.js',
        'src/dashboard-main.js',
        'src/react/**',
        'src/lib/pages/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/lib')
    }
  }
});
