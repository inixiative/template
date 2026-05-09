import { spyOn } from 'bun:test';

// Forbidden: this file spies but never restores, so the spy persists across
// tests and can leak into siblings.
spyOn(globalThis, 'fetch').mockImplementation(
  (() => Promise.resolve(new Response('leak'))) as typeof fetch,
);
