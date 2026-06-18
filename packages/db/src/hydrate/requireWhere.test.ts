import { describe, expect, it } from 'bun:test';
import { requireWhere } from '@template/db/hydrate/requireWhere';

describe('requireWhere', () => {
  it('throws on an empty where', () => {
    expect(() => requireWhere({})).toThrow();
  });

  it('passes a real where', () => {
    expect(() => requireWhere({ id: '123' })).not.toThrow();
  });
});
