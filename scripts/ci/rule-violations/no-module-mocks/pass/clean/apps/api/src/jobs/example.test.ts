// No module mocks — uses dependency injection / a real-or-fake adapter passed
// through the worker context.
import { describe, it } from 'bun:test';

describe('example', () => {
  it('runs without mock.module', () => {
    // Test relies on injected ctx, not module replacement.
  });
});
