import { describe, expect, it } from 'bun:test';
import { wellFormedEntitlements } from '@template/permissions/roles/wellFormedEntitlements';

const entry = (actions: string[], id = 'o1') => ({
  resource: 'db:space',
  anchor: { resource: 'db:organization', id, path: 'organization' },
  actions: Object.fromEntries(actions.map((action) => [action, true])),
});

describe('wellFormedEntitlements', () => {
  it('drops malformed entries', () => {
    expect(
      wellFormedEntitlements([entry(['read']), { resource: 'db:space' }, 'x', entry([])]),
    ).toEqual([entry(['read'])]);
  });

  it('drops an entry identical to another, or the same with fewer actions', () => {
    expect(
      wellFormedEntitlements([entry(['read']), entry(['read', 'manage']), entry(['read'])]),
    ).toEqual([entry(['read', 'manage'])]);
    expect(wellFormedEntitlements([entry(['read']), entry(['read'], 'o2')])).toEqual([
      entry(['read']),
      entry(['read'], 'o2'),
    ]);
  });

  it('is empty for anything but an array', () => {
    expect(wellFormedEntitlements(null)).toEqual([]);
  });
});
