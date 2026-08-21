import { describe, expect, it } from 'bun:test';
import { filterFields, NOOP_FIELDS, unionRegistries, WEBHOOK_DROP_FIELDS } from '@template/db/registries';

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

  it('with WEBHOOK_DROP_FIELDS also drops sensitive columns', () => {
    const data = { id: '1', keyHash: 'h', name: 'tok', updatedAt: new Date() };
    const result = filterFields('Token', data, WEBHOOK_DROP_FIELDS);
    expect(result).not.toHaveProperty('keyHash');
    expect(result).not.toHaveProperty('updatedAt');
    expect(result).toMatchObject({ id: '1', name: 'tok' });
  });
});
