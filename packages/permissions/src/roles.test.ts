import { describe, expect, it } from 'bun:test';
import { greaterRole, intersectEntitlements, isSuperadmin, lesserRole, roleHierarchy } from './roles';

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
  it('returns viewer when both null/undefined', () => {
    expect(lesserRole(null, null)).toBe('viewer');
    expect(lesserRole(undefined, undefined)).toBe('viewer');
  });

  it('returns the defined role when one is null', () => {
    expect(lesserRole('admin', null)).toBe('admin');
    expect(lesserRole(null, 'member')).toBe('member');
  });

  it('returns lesser of two roles', () => {
    expect(lesserRole('owner', 'admin')).toBe('admin');
    expect(lesserRole('admin', 'member')).toBe('member');
    expect(lesserRole('member', 'viewer')).toBe('viewer');
    expect(lesserRole('owner', 'viewer')).toBe('viewer');
  });

  it('returns same role when equal', () => {
    for (const role of roleHierarchy) {
      expect(lesserRole(role, role)).toBe(role);
    }
  });
});

describe('greaterRole', () => {
  it('returns viewer when both null/undefined', () => {
    expect(greaterRole(null, null)).toBe('viewer');
    expect(greaterRole(undefined, undefined)).toBe('viewer');
  });

  it('returns the defined role when one is null', () => {
    expect(greaterRole('admin', null)).toBe('admin');
    expect(greaterRole(null, 'member')).toBe('member');
  });

  it('returns greater of two roles', () => {
    expect(greaterRole('owner', 'admin')).toBe('owner');
    expect(greaterRole('admin', 'member')).toBe('admin');
    expect(greaterRole('member', 'viewer')).toBe('member');
    expect(greaterRole('viewer', 'owner')).toBe('owner');
  });

  it('returns same role when equal', () => {
    for (const role of roleHierarchy) {
      expect(greaterRole(role, role)).toBe(role);
    }
  });
});

describe('intersectEntitlements', () => {
  it('returns null when both null/undefined', () => {
    expect(intersectEntitlements(null, null)).toBe(null);
    expect(intersectEntitlements(undefined, undefined)).toBe(null);
  });

  it('returns the defined entitlements when one is null', () => {
    const ent = { canExport: true };
    expect(intersectEntitlements(ent, null)).toEqual(ent);
    expect(intersectEntitlements(null, ent)).toEqual(ent);
  });

  it('returns intersection of entitlements', () => {
    const a = { canExport: true, canImport: true };
    const b = { canExport: true, canDelete: true };
    expect(intersectEntitlements(a, b)).toEqual({ canExport: true });
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
