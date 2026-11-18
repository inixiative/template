import { describe, expect, it } from 'bun:test';
import { validateWhereIsNotEmpty } from '@template/db/hydrate/validateWhereIsNotEmpty';

describe('validateWhereIsNotEmpty', () => {
  it('throws on an empty where', () => {
    expect(() => validateWhereIsNotEmpty({})).toThrow();
  });

  it('passes a real where', () => {
    expect(() => validateWhereIsNotEmpty({ id: '123' })).not.toThrow();
  });
});
