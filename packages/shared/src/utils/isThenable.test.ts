import { describe, expect, it } from 'bun:test';
import { isThenable } from '@template/shared/utils/isThenable';

describe('isThenable', () => {
  it('recognizes promises and promise-likes', () => {
    expect(isThenable(Promise.resolve())).toBe(true);
    expect(isThenable({ then: () => undefined })).toBe(true);
  });

  it('rejects everything a sync handler returns', () => {
    for (const value of [undefined, null, 0, 'then', {}, { then: true }, () => undefined])
      expect(isThenable(value)).toBe(false);
  });
});
