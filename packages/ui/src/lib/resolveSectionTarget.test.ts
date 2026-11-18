import { afterEach, describe, expect, it } from 'bun:test';
import { resolveSectionTarget } from '@template/ui/lib/resolveSectionTarget';

describe('resolveSectionTarget', () => {
  afterEach(() => {
    for (const el of document.body.querySelectorAll('[data-section]')) el.remove();
  });

  it('resolves simple section', () => {
    const el = document.createElement('div');
    el.setAttribute('data-section', 'users');
    document.body.appendChild(el);
    expect(resolveSectionTarget('users')).toBe(el);
  });

  it('resolves dot-notated child by data-key', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'usersTable');
    const child = document.createElement('div');
    child.setAttribute('data-key', 'usr_abc');
    parent.appendChild(child);
    document.body.appendChild(parent);
    expect(resolveSectionTarget('usersTable.usr_abc')).toBe(child);
  });

  it('resolves numeric index fallback', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'items');
    for (let i = 0; i < 5; i++) {
      const row = document.createElement('div');
      row.setAttribute('data-key', `item-${i}`);
      parent.appendChild(row);
    }
    document.body.appendChild(parent);
    expect(resolveSectionTarget('items.3')?.getAttribute('data-key')).toBe('item-3');
  });

  it('returns null for missing section', () => {
    expect(resolveSectionTarget('nonexistent')).toBeNull();
  });

  it('returns null for missing child key', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'table');
    document.body.appendChild(parent);
    expect(resolveSectionTarget('table.missing')).toBeNull();
  });

  it('returns null for out-of-range index', () => {
    const parent = document.createElement('div');
    parent.setAttribute('data-section', 'items');
    const row = document.createElement('div');
    row.setAttribute('data-key', 'only');
    parent.appendChild(row);
    document.body.appendChild(parent);
    expect(resolveSectionTarget('items.99')).toBeNull();
  });
});
