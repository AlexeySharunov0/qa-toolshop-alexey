import { expect } from '@playwright/test';

/**
 * Two small matchers used across the suite. They keep range assertions
 * readable and, more importantly, produce a message that says what *was*
 * observed - which is what turns a red run into a usable bug report.
 */
expect.extend({
  toBeWithin(received: number, min: number, max: number) {
    const pass = typeof received === 'number' && received >= min && received <= max;
    return {
      pass,
      message: () =>
        `expected status ${received} to be within ${min}..${max} (got ${received})`,
    };
  },

  toBeOneOf(received: unknown, allowed: unknown[]) {
    const pass = allowed.includes(received);
    return {
      pass,
      message: () =>
        `expected ${JSON.stringify(received)} to be one of ${allowed
          .map((value) => JSON.stringify(value))
          .join(', ')}`,
    };
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace PlaywrightTest {
    interface Matchers<R> {
      toBeWithin(min: number, max: number): R;
      toBeOneOf(allowed: unknown[]): R;
    }
  }
}

export {};
