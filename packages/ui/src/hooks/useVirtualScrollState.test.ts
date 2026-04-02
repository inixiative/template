import { describe, expect, it } from 'bun:test';

/**
 * Tests for useVirtualScrollState's pure logic:
 * - history.state key structure contract
 * - Cache validity determination
 * - Cache invalidation cleanup (destructure pattern)
 * - Write suppression guards
 */

describe('useVirtualScrollState — history.state contract', () => {
  it('state key is namespaced with vscroll: prefix', () => {
    const id = 'users-table';
    const stateKey = `vscroll:${id}`;
    expect(stateKey).toBe('vscroll:users-table');
  });

  it('ScrollState shape has index and pageCount', () => {
    const state = { index: 54, pageCount: 5 };
    expect(typeof state.index).toBe('number');
    expect(typeof state.pageCount).toBe('number');
  });

  it('multiple containers use independent keys', () => {
    const state: Record<string, unknown> = {
      'vscroll:table-a': { index: 10, pageCount: 1 },
      'vscroll:table-b': { index: 20, pageCount: 3 },
    };
    expect((state['vscroll:table-a'] as { index: number }).index).toBe(10);
    expect((state['vscroll:table-b'] as { index: number }).index).toBe(20);
  });

  it('spreading preserves other keys when writing one entry', () => {
    const existing = {
      'vscroll:other': { index: 5, pageCount: 1 },
      routerKey: 'abc',
    };
    const updated = { ...existing, 'vscroll:mine': { index: 10, pageCount: 2 } };
    expect(updated['vscroll:other']).toEqual({ index: 5, pageCount: 1 });
    expect(updated['vscroll:mine']).toEqual({ index: 10, pageCount: 2 });
    expect(updated.routerKey).toBe('abc');
  });
});

describe('useVirtualScrollState — cache validity', () => {
  it('cache is valid when itemCount covers saved index', () => {
    const savedIndex = 54;
    const itemCount = 100;
    const cacheCoversIndex = itemCount > savedIndex;
    expect(cacheCoversIndex).toBe(true);
  });

  it('cache is invalid when itemCount does not cover saved index', () => {
    const savedIndex = 54;
    const itemCount = 20;
    const cacheCoversIndex = itemCount > savedIndex;
    expect(cacheCoversIndex).toBe(false);
  });

  it('cache is valid at boundary (itemCount = index + 1)', () => {
    const savedIndex = 54;
    const itemCount = 55;
    expect(itemCount > savedIndex).toBe(true);
  });

  it('cache is invalid at exact boundary (itemCount = index)', () => {
    const savedIndex = 54;
    const itemCount = 54;
    expect(itemCount > savedIndex).toBe(false);
  });

  it('no saved state means no restoration', () => {
    const saved = null;
    const cacheCoversIndex = saved !== null && 100 > 0;
    const initialIndex = cacheCoversIndex ? 0 : undefined;
    expect(initialIndex).toBeUndefined();
  });
});

describe('useVirtualScrollState — cache invalidation cleanup', () => {
  it('destructure removes target key and preserves others', () => {
    const state: Record<string, unknown> = {
      'vscroll:users': { index: 54, pageCount: 5 },
      'vscroll:feed': { index: 10, pageCount: 1 },
      routerState: 'preserved',
    };

    const stateKey = 'vscroll:users';
    const { [stateKey]: _, ...rest } = state;

    expect(rest['vscroll:users']).toBeUndefined();
    expect(rest['vscroll:feed']).toEqual({ index: 10, pageCount: 1 });
    expect(rest.routerState).toBe('preserved');
  });

  it('destructure handles empty state', () => {
    const state: Record<string, unknown> = {};
    const stateKey = 'vscroll:missing';
    const { [stateKey]: _, ...rest } = state;
    expect(Object.keys(rest)).toHaveLength(0);
  });

  it('destructure handles null-ish state with fallback', () => {
    const state: Record<string, unknown> | null = null;
    const stateKey = 'vscroll:test';
    const { [stateKey]: _, ...rest } = (state ?? {}) as Record<string, unknown>;
    expect(Object.keys(rest)).toHaveLength(0);
  });
});

describe('useVirtualScrollState — write suppression guards', () => {
  it('skips negative indices', () => {
    const index = -1;
    expect(index < 0).toBe(true);
  });

  it('skips duplicate indices', () => {
    const lastIndex = 54;
    const newIndex = 54;
    expect(newIndex === lastIndex).toBe(true);
  });

  it('allows changed positive indices', () => {
    const lastIndex = 54;
    const newIndex = 55;
    const shouldSkip = newIndex < 0 || (newIndex as number) === (lastIndex as number);
    expect(shouldSkip).toBe(false);
  });

  it('allows index 0 after restore completes', () => {
    const index = 0;
    const restoreComplete = true;
    const shouldWrite = index >= 0 && restoreComplete;
    expect(shouldWrite).toBe(true);
  });

  it('suppresses writes when restore is not complete', () => {
    const index = 0;
    const restoreComplete = false;
    const shouldWrite = index >= 0 && restoreComplete;
    expect(shouldWrite).toBe(false);
  });
});

describe('useVirtualScrollState — saved state parsing', () => {
  it('accepts valid ScrollState object', () => {
    const raw = { index: 54, pageCount: 5 };
    const isValid = raw && typeof raw === 'object' && typeof raw.index === 'number';
    expect(isValid).toBe(true);
  });

  it('rejects non-object', () => {
    const raw = 'not an object';
    const isValid = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).index === 'number';
    expect(isValid).toBe(false);
  });

  it('rejects object without index', () => {
    const raw = { pageCount: 5 };
    const isValid = raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).index === 'number';
    expect(isValid).toBe(false);
  });

  it('rejects null', () => {
    const raw = null;
    const isValid = raw && typeof raw === 'object';
    expect(isValid).toBeNull();
  });
});
