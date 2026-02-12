import { describe, expect, it } from 'bun:test';
import { greaterRole, intersectEntitlements, isSuperadmin, lesserRole, roleHierarchy } from '@template/permissions/roles/shared';

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

describe('lesserRole', () => {
  it('returns viewer when all null/undefined', () => {
    expect(lesserRole(null, null)).toBe('viewer');
    expect(lesserRole(undefined, undefined)).toBe('viewer');
    expect(lesserRole()).toBe('viewer');
  });

  it('returns the defined role when others are null', () => {
    expect(lesserRole('admin', null)).toBe('admin');
    expect(lesserRole(null, 'member')).toBe('member');
    expect(lesserRole(null, 'admin', undefined)).toBe('admin');
  });

  it('returns lesser of N roles', () => {
    expect(lesserRole('owner', 'admin')).toBe('admin');
    expect(lesserRole('admin', 'member')).toBe('member');
    expect(lesserRole('member', 'viewer')).toBe('viewer');
    expect(lesserRole('owner', 'viewer')).toBe('viewer');
    expect(lesserRole('owner', 'admin', 'member')).toBe('member');
    expect(lesserRole('owner', 'admin', 'viewer')).toBe('viewer');
  });

  it('returns same role when equal', () => {
    for (const role of roleHierarchy) {
      expect(lesserRole(role, role)).toBe(role);
    }
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

describe('intersectEntitlements', () => {
  it('returns null when all null/undefined', () => {
    expect(intersectEntitlements(null, null)).toBe(null);
    expect(intersectEntitlements(undefined, undefined)).toBe(null);
    expect(intersectEntitlements()).toBe(null);
  });

  it('returns the defined entitlements when others are null', () => {
    const ent = { canExport: true };
    expect(intersectEntitlements(ent, null)).toEqual(ent);
    expect(intersectEntitlements(null, ent)).toEqual(ent);
    expect(intersectEntitlements(null, ent, undefined)).toEqual(ent);
  });

  it('returns intersection of N entitlements', () => {
    const a = { canExport: true, canImport: true };
    const b = { canExport: true, canDelete: true };
    const c = { canExport: true, canView: true };
    expect(intersectEntitlements(a, b)).toEqual({ canExport: true });
    expect(intersectEntitlements(a, b, c)).toEqual({ canExport: true });
  });

  it('returns null when no overlap', () => {
    const a = { canExport: true };
    const b = { canImport: true };
    expect(intersectEntitlements(a, b)).toBe(null);
  });

  it('ignores false values', () => {
    const a = { canExport: true, canImport: false };
    const b = { canExport: true, canImport: true };
    expect(intersectEntitlements(a, b)).toEqual({ canExport: true });
  });
});
