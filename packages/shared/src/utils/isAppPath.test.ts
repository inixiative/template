import { describe, expect, it } from 'bun:test';
import { isAppPath } from '@template/shared/utils';

describe('isAppPath', () => {
  it('accepts in-app paths with search and hash', () => {
    expect(isAppPath('/settings/tokens?org=1#create-token')).toBe(true);
  });

  it('rejects absolute, protocol-relative and relative URLs', () => {
    for (const value of [
      'https://evil.test',
      '//evil.test',
      '/\\evil.test',
      'settings',
      'javascript:alert(1)',
    ])
      expect(isAppPath(value)).toBe(false);
  });
});
