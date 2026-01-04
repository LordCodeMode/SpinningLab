/**
 * Vitest Setup File
 * Runs before all tests
 */

// Setup DOM globals
global.window = window;
global.document = document;
global.navigator = window.navigator;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
global.localStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn();

// Mock console methods to keep test output clean
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn()
};
