import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens/lensFor';
import { prune } from '@template/db/lens/prune';

describe('prune', () => {
  it('keeps only the available fields (single)', () => {
    const lens: LensNarrowing = { parent: lensFor('Inquiry'), root: { picks: ['id', 'status'] } };
    expect(prune({ id: 'i1', status: 'sent', content: { x: 1 } }, lens)).toEqual({ id: 'i1', status: 'sent' });
  });

  it('prunes each element of an array', () => {
    const lens: LensNarrowing = { parent: lensFor('Inquiry'), root: { picks: ['id'] } };
    expect(
      prune(
        [
          { id: 'a', x: 1 },
          { id: 'b', x: 2 },
        ],
        lens,
      ),
    ).toEqual([{ id: 'a' }, { id: 'b' }]);
  });

  it('prunes a nested to-one relation', () => {
    const lens: LensNarrowing = {
      parent: lensFor('Inquiry'),
      root: { picks: ['id', 'sourceUser'], relations: { sourceUser: { picks: ['id'] } } },
    };
    const row = { id: 'i1', sourceUser: { id: 'u1', name: 'Bob', email: 'b@x.com' } };
    expect(prune(row, lens)).toEqual({ id: 'i1', sourceUser: { id: 'u1' } });
  });

  it('prunes a nested to-many relation', () => {
    const lens: LensNarrowing = {
      parent: lensFor('Inquiry'),
      root: { picks: ['id', 'auditLogsAsSubject'], relations: { auditLogsAsSubject: { picks: ['id'] } } },
    };
    const row = {
      id: 'i1',
      auditLogsAsSubject: [
        { id: 'a1', detail: 'x' },
        { id: 'a2', detail: 'y' },
      ],
    };
    expect(prune(row, lens)).toEqual({ id: 'i1', auditLogsAsSubject: [{ id: 'a1' }, { id: 'a2' }] });
  });
});
