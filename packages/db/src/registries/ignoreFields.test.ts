import { describe, expect, it } from 'bun:test';
import { filterFields, isNoOpUpdate, NOOP_FIELDS, unionRegistries, WEBHOOK_NOOP_FIELDS } from '@template/db/registries';

describe('NOOP_FIELDS', () => {
  it('includes global updatedAt and high-frequency tracking columns', () => {
    expect(NOOP_FIELDS._global).toContain('updatedAt');
    expect(NOOP_FIELDS.User).toContain('lastLoginAt');
    expect(NOOP_FIELDS.Token).toContain('lastUsedAt');
  });

  it('folds in ordered-list position fields (Contact)', () => {
    expect(NOOP_FIELDS.Contact).toContain('position');
  });

  it('does NOT include encrypted columns — those belong to REDACT_FIELDS', () => {
    expect(NOOP_FIELDS.AuthProvider ?? []).not.toContain('encryptedSecrets');
  });
});

describe('unionRegistries', () => {
  it('merges and de-duplicates fields per model', () => {
    const merged = unionRegistries({ A: ['x', 'y'] }, { A: ['y', 'z'], B: ['q'] });
    expect(new Set(merged.A)).toEqual(new Set(['x', 'y', 'z']));
    expect(merged.B).toEqual(['q']);
  });
});

describe('filterFields', () => {
  it('drops the registry _global + model fields and keeps the rest', () => {
    const data = { id: '1', name: 'test', updatedAt: new Date(), lastLoginAt: new Date() };
    const result = filterFields('User', data, NOOP_FIELDS);
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).not.toHaveProperty('lastLoginAt');
    expect(result).toMatchObject({ id: '1', name: 'test' });
  });

  it('with WEBHOOK_NOOP_FIELDS also drops sensitive columns', () => {
    const data = { id: '1', keyHash: 'h', name: 'tok', updatedAt: new Date() };
    const result = filterFields('Token', data, WEBHOOK_NOOP_FIELDS);
    expect(result).not.toHaveProperty('keyHash');
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).toMatchObject({ id: '1', name: 'tok' });
  });
});

describe('isNoOpUpdate', () => {
  it('returns false when no previous data', () => {
    expect(isNoOpUpdate('User', { id: '123', name: 'Test' }, undefined, NOOP_FIELDS)).toBe(false);
  });

  it('returns true when only ignored fields changed', () => {
    const previous = { id: '123', name: 'Test', updatedAt: new Date('2024-01-01') };
    const current = { id: '123', name: 'Test', updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('User', current, previous, NOOP_FIELDS)).toBe(true);
  });

  it('returns false when relevant fields changed', () => {
    const previous = { id: '123', name: 'Old Name', updatedAt: new Date('2024-01-01') };
    const current = { id: '123', name: 'New Name', updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('User', current, previous, NOOP_FIELDS)).toBe(false);
  });

  it('returns true for model-specific ignored field changes', () => {
    const previous = { id: '123', name: 'Token', lastUsedAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') };
    const current = { id: '123', name: 'Token', lastUsedAt: new Date('2024-01-02'), updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('Token', current, previous, NOOP_FIELDS)).toBe(true);
  });

  it('returns false when non-ignored field changes alongside ignored', () => {
    const previous = { id: '123', name: 'Old Token', lastUsedAt: new Date('2024-01-01'), updatedAt: new Date('2024-01-01') };
    const current = { id: '123', name: 'New Token', lastUsedAt: new Date('2024-01-02'), updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('Token', current, previous, NOOP_FIELDS)).toBe(false);
  });

  it('treats a sensitive-only change as a real change under NOOP_FIELDS', () => {
    const previous = { id: '123', keyHash: 'old-hash', updatedAt: new Date('2024-01-01') };
    const current = { id: '123', keyHash: 'new-hash', updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('Token', current, previous, NOOP_FIELDS)).toBe(false);
  });

  it('treats a sensitive-only change as a no-op under WEBHOOK_NOOP_FIELDS', () => {
    const previous = { id: '123', keyHash: 'old-hash', updatedAt: new Date('2024-01-01') };
    const current = { id: '123', keyHash: 'new-hash', updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('Token', current, previous, WEBHOOK_NOOP_FIELDS)).toBe(true);
  });
});
