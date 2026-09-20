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

  it("keeps the columns a visit's where reads, so the pruned row can still be judged by the lens", () => {
    const lens: LensNarrowing = {
      parent: lensFor('Inquiry'),
      root: {
        picks: ['id', 'sourceUser'],
        relations: { sourceUser: { picks: ['id'], where: { field: 'deletedAt', operator: 'notExists' } } },
      },
      mapDefaults: {
        prisma: { models: { Inquiry: { where: { field: 'status', operator: 'equals', value: 'sent' } } } },
      },
    };
    const row = { id: 'i1', status: 'sent', content: 1, sourceUser: { id: 'u1', name: 'Bob', deletedAt: null } };
    expect(prune(row, lens)).toEqual({ id: 'i1', status: 'sent', sourceUser: { id: 'u1', deletedAt: null } });
  });

  it("drops the related rows a visit's where hides: a list element is filtered out, a to-one becomes null", () => {
    const lens = {
      parent: lensFor('User'),
      root: {
        picks: ['id'],
        relations: {
          tagAttachments: {
            picks: [],
            where: { field: 'deletedAt', operator: 'notExists' },
            relations: {
              tag: { picks: ['id', 'name'], where: { field: 'ownerModel', operator: 'equals', value: 'platform' } },
            },
          },
        },
      },
    } as const;
    const row = {
      id: 'u1',
      tagAttachments: [
        { deletedAt: null, tag: { id: 'mine', name: 'vip', ownerModel: 'platform' } },
        { deletedAt: null, tag: { id: 'theirs', name: 'vip', ownerModel: 'Organization' } },
        { deletedAt: '2026-01-01', tag: { id: 'gone', name: 'vip', ownerModel: 'platform' } },
      ],
    };
    expect(prune(row, lens as never) as unknown).toEqual({
      id: 'u1',
      tagAttachments: [
        { deletedAt: null, tag: { id: 'mine', name: 'vip', ownerModel: 'platform' } },
        { deletedAt: null, tag: null },
      ],
    });
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
