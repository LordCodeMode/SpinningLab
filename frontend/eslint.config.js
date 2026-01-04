import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        FormData: 'readonly',
        URLSearchParams: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        NodeList: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        URL: 'readonly',
        feather: 'readonly',
        Chart: 'readonly',
        __APP_VERSION__: 'readonly'
      }
    },
    rules: {
      // Error Prevention
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }],
      'no-undef': 'error',
      'no-console': 'off', // Allow console for debugging
      'no-debugger': 'warn',

      // Best Practices
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-with': 'error',
      'no-new-func': 'error',
      'no-return-await': 'warn',

      // Code Style (handled by Prettier, but good to have)
      'semi': ['error', 'always'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'comma-dangle': ['error', 'never'],

      // Modern JS
      'prefer-const': 'warn',
      'prefer-arrow-callback': 'warn',
      'no-var': 'error',

      // Async/Await
      'require-await': 'warn',
      'no-async-promise-executor': 'error',

      // Imports
      'no-duplicate-imports': 'error'
    }
  },
  {
    // Test files can be more lenient
    files: ['**/*.test.js', '**/*.spec.js'],
    rules: {
      'no-unused-expressions': 'off'
    }
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '*.min.js',
      'vite.config.js'
    ]
  }
];
