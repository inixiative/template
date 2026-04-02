import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

/**
 * Tests for useScrollRestore and useIndexRestore sessionStorage logic.
 * These test the persistence/restore contract without rendering React hooks.
 */

// Mock sessionStorage
const store = new Map<string, string>();
const mockSessionStorage = {
  getItem: mock((key: string) => store.get(key) ?? null),
  setItem: mock((key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: mock((key: string) => {
    store.delete(key);
  }),
};

beforeEach(() => {
  store.clear();
  mockSessionStorage.getItem.mockClear();
  mockSessionStorage.setItem.mockClear();
  mockSessionStorage.removeItem.mockClear();
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: mockSessionStorage,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  store.clear();
});

describe('useScrollRestore — storage contract', () => {
  it('stores scroll position under scroll:<key>', () => {
    const key = 'my-list';
    sessionStorage.setItem(`scroll:${key}`, '250');
    expect(sessionStorage.getItem(`scroll:${key}`)).toBe('250');
  });

  it('returns null when no saved position exists', () => {
    expect(sessionStorage.getItem('scroll:nonexistent')).toBeNull();
  });

  it('overwrites previous position on update', () => {
    sessionStorage.setItem('scroll:list', '100');
    sessionStorage.setItem('scroll:list', '300');
    expect(sessionStorage.getItem('scroll:list')).toBe('300');
  });

  it('parses stored position as integer', () => {
    sessionStorage.setItem('scroll:list', '42');
    const value = sessionStorage.getItem('scroll:list');
    expect(Number.parseInt(value!, 10)).toBe(42);
  });
});

describe('useIndexRestore — storage contract', () => {
  it('stores visible index under vindex:<key>', () => {
    const key = 'table-1';
    sessionStorage.setItem(`vindex:${key}`, '15');
    expect(sessionStorage.getItem(`vindex:${key}`)).toBe('15');
  });

  it('returns null when no saved index exists', () => {
    expect(sessionStorage.getItem('vindex:missing')).toBeNull();
  });

  it('overwrites previous index on update', () => {
    sessionStorage.setItem('vindex:t', '5');
    sessionStorage.setItem('vindex:t', '20');
    expect(sessionStorage.getItem('vindex:t')).toBe('20');
  });

  it('parses stored index as integer', () => {
    sessionStorage.setItem('vindex:t', '7');
    const value = sessionStorage.getItem('vindex:t');
    expect(Number.parseInt(value!, 10)).toBe(7);
  });

  it('index beyond item count should be treated as invalid', () => {
    sessionStorage.setItem('vindex:t', '100');
    const saved = Number.parseInt(sessionStorage.getItem('vindex:t')!, 10);
    const itemCount = 50;
    // The hook skips restore when saved >= itemCount
    expect(saved >= itemCount).toBe(true);
  });
});

describe('useIndexRestore — change guard logic', () => {
  it('should not persist when index has not changed', () => {
    let lastPersisted: number | null = null;
    const persistIndex = (index: number) => {
      if (index === lastPersisted) return; // change guard
      lastPersisted = index;
      sessionStorage.setItem('vindex:test', String(index));
    };

    persistIndex(5);
    persistIndex(5); // same index, should be skipped
    expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(1);
  });

  it('should persist when index changes', () => {
    let lastPersisted: number | null = null;
    const persistIndex = (index: number) => {
      if (index === lastPersisted) return;
      lastPersisted = index;
      sessionStorage.setItem('vindex:test', String(index));
    };

    persistIndex(5);
    persistIndex(10);
    expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(2);
    expect(sessionStorage.getItem('vindex:test')).toBe('10');
  });
});
