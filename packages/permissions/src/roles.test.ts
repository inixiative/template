import { describe, expect, it } from 'bun:test';
import { isSuperadmin } from '@template/permissions/roles/shared';

describe('isSuperadmin', () => {
  it('returns true for superadmin', () => {
    expect(isSuperadmin({ platformRole: 'superadmin' })).toBe(true);
  });

  it('returns false for user role', () => {
    expect(isSuperadmin({ platformRole: 'user' })).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isSuperadmin(null)).toBe(false);
    expect(isSuperadmin(undefined)).toBe(false);
  });
});
