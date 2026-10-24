import { describe, expect, it } from 'bun:test';
import { greaterRole, isSuperadmin, roleHierarchy } from '@template/permissions/roles/shared';

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

describe('greaterRole', () => {
  it('returns viewer when all null/undefined', () => {
    expect(greaterRole(null, null)).toBe('viewer');
    expect(greaterRole(undefined, undefined)).toBe('viewer');
    expect(greaterRole()).toBe('viewer');
  });

  it('returns the defined role when others are null', () => {
    expect(greaterRole('admin', null)).toBe('admin');
    expect(greaterRole(null, 'member')).toBe('member');
    expect(greaterRole(null, 'viewer', undefined)).toBe('viewer');
  });

  it('returns greater of N roles', () => {
    expect(greaterRole('owner', 'admin')).toBe('owner');
    expect(greaterRole('admin', 'member')).toBe('admin');
    expect(greaterRole('member', 'viewer')).toBe('member');
    expect(greaterRole('viewer', 'owner')).toBe('owner');
    expect(greaterRole('viewer', 'member', 'admin')).toBe('admin');
    expect(greaterRole('viewer', 'member', 'owner')).toBe('owner');
  });

  it('returns same role when equal', () => {
    for (const role of roleHierarchy) {
      expect(greaterRole(role, role)).toBe(role);
    }
  });
});
