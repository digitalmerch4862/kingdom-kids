import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock environment variables
Object.defineProperty(import.meta, 'env', {
  value: {
    API_KEY: 'test-api-key',
  },
  writable: true,
});

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};
