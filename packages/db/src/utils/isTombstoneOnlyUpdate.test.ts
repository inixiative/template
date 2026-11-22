import { describe, expect, it } from 'bun:test';
import { isTombstoneOnlyUpdate } from '@template/db/utils/isTombstoneOnlyUpdate';

describe('isTombstoneOnlyUpdate', () => {
  it('returns true for soft-delete and revive payloads (plain and { set } wrapper)', () => {
    expect(isTombstoneOnlyUpdate({ deletedAt: new Date() })).toBe(true);
    expect(isTombstoneOnlyUpdate({ deletedAt: '2026-11-22T00:00:00.000Z' })).toBe(true);
    expect(isTombstoneOnlyUpdate({ deletedAt: null })).toBe(true);
    expect(isTombstoneOnlyUpdate({ deletedAt: { set: new Date() } })).toBe(true);
    expect(isTombstoneOnlyUpdate({ deletedAt: { set: null } })).toBe(true);
    expect(isTombstoneOnlyUpdate({ deletedAt: new Date(), valueText: undefined })).toBe(true);
  });

  it('returns false for empty, non-object, or mixed field updates', () => {
    expect(isTombstoneOnlyUpdate({})).toBe(false);
    expect(isTombstoneOnlyUpdate(null)).toBe(false);
    expect(isTombstoneOnlyUpdate(undefined)).toBe(false);
    expect(isTombstoneOnlyUpdate([])).toBe(false);
    expect(isTombstoneOnlyUpdate({ deletedAt: undefined })).toBe(false);
    expect(isTombstoneOnlyUpdate({ deletedAt: new Date(), valueText: 'UTC' })).toBe(false);
    expect(isTombstoneOnlyUpdate({ valueText: 'UTC' })).toBe(false);
    expect(isTombstoneOnlyUpdate({ deletedAt: { set: new Date(), extra: true } })).toBe(false);
  });
});
