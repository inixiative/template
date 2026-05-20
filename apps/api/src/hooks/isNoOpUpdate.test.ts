import { describe, expect, it } from 'bun:test';
import { isNoOpUpdate } from '#/hooks/isNoOpUpdate';

describe('isNoOpUpdate', () => {
  it('returns false when no previous data', () => {
    expect(isNoOpUpdate('User', { id: '123', name: 'Test' }, undefined)).toBe(false);
  });

  it('returns true when only ignored fields changed', () => {
    const previous = { id: '123', name: 'Test', updatedAt: new Date('2024-01-01') };
    const current = { id: '123', name: 'Test', updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('User', current, previous)).toBe(true);
  });

  it('returns false when relevant fields changed', () => {
    const previous = { id: '123', name: 'Old Name', updatedAt: new Date('2024-01-01') };
    const current = { id: '123', name: 'New Name', updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('User', current, previous)).toBe(false);
  });

  it('returns true for model-specific ignored field changes', () => {
    const previous = {
      id: '123',
      name: 'Token',
      lastUsedAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    const current = { id: '123', name: 'Token', lastUsedAt: new Date('2024-01-02'), updatedAt: new Date('2024-01-02') };
    expect(isNoOpUpdate('Token', current, previous)).toBe(true);
  });

  it('returns false when non-ignored field changes alongside ignored', () => {
    const previous = {
      id: '123',
      name: 'Old Token',
      lastUsedAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
    const current = {
      id: '123',
      name: 'New Token',
      lastUsedAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
    };
    expect(isNoOpUpdate('Token', current, previous)).toBe(false);
  });
});
