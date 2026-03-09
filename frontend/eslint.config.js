import js from '@eslint/js';

const browserGlobals = {
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
  Chart: 'readonly',
  feather: 'readonly',
  history: 'readonly',
  location: 'readonly',
  performance: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  structuredClone: 'readonly',
  BroadcastChannel: 'readonly',
  confirm: 'readonly',
  TextDecoder: 'readonly',
  __APP_VERSION__: 'readonly'
};

const nodeGlobals = {
  process: 'readonly',
  console: 'readonly',
  __dirname: 'readonly'
};

const testGlobals = {
  ...browserGlobals,
  global: 'readonly',
  vi: 'readonly',
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly'
};

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'public/unity/**',
      '**/*.min.js'
    ]
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-debugger': 'warn',
      'prefer-const': 'warn',
      'require-await': 'off',
      'no-duplicate-imports': 'warn',
      'no-dupe-class-members': 'warn',
      'no-useless-escape': 'warn',
      'eqeqeq': 'warn',
      'quotes': 'warn',
      'semi': 'warn',
      'comma-dangle': 'off',
      'no-var': 'warn'
    }
  },
  {
    files: ['tests/**/*.js', 'vitest.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: testGlobals
    },
    rules: {
      'no-unused-expressions': 'off',
      'no-unused-vars': 'warn',
      'require-await': 'off',
      'no-useless-escape': 'warn',
      'quotes': 'warn',
      'semi': 'warn',
      'eqeqeq': 'warn',
      'comma-dangle': 'off'
    }
  },
  {
    files: ['scripts/**/*.mjs', '*.config.js', 'vite.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: nodeGlobals
    },
    rules: {
      'no-console': 'off',
      'quotes': 'warn',
      'semi': 'warn',
      'eqeqeq': 'warn',
      'comma-dangle': 'off'
    }
  }
];
