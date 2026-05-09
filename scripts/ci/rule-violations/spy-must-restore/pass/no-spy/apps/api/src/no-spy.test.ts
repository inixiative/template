import { describe, expect, it } from 'bun:test';

describe('no spies here', () => {
  it('passes trivially', () => {
    expect(1 + 1).toBe(2);
  });
});
