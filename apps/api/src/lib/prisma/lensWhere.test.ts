import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { lensWhere } from '#/lib/prisma/lensWhere';

const ACTIVE_TOKENS: LensNarrowing = {
  parent: lensFor('User'),
  root: {
    picks: ['name'],
    relations: {
      tokens: { picks: ['name'], where: { field: 'isActive', operator: 'equals', value: true } },
    },
  },
};

describe('lensWhere', () => {
  it('folds a relation-node where into every traversal of that relation', () => {
    expect(lensWhere(ACTIVE_TOKENS, { tokens: { some: { name: 'x' } } })).toEqual({
      tokens: { some: { name: 'x', isActive: { equals: true } } },
    });
  });

  it('a relation the query never traverses contributes nothing', () => {
    expect(lensWhere(ACTIVE_TOKENS, { name: 'x' })).toEqual({ name: 'x' });
  });

  it('composes into `every` by implication', () => {
    expect(lensWhere(ACTIVE_TOKENS, { tokens: { every: { name: 'x' } } })).toEqual({
      tokens: { every: { OR: [{ NOT: { isActive: { equals: true } } }, { name: 'x' }] } },
    });
  });

  it('bare `isNot` gets the node where as a fail-closed `is` sibling', () => {
    expect(lensWhere(ACTIVE_TOKENS, { tokens: { isNot: { name: 'x' } } })).toEqual({
      tokens: { isNot: { name: 'x' }, is: { isActive: { equals: true } } },
    });
  });

  it('a lens with no relation wheres returns the where untouched', () => {
    const bare: LensNarrowing = { parent: lensFor('User'), root: { picks: ['name'] } };
    const where = { tokens: { some: { name: 'x' } } };
    expect(lensWhere(bare, where)).toBe(where);
  });

  it('a nested relation where applies at its own depth', () => {
    const nested: LensNarrowing = {
      parent: lensFor('Organization'),
      root: {
        picks: ['name'],
        relations: {
          spaces: {
            picks: ['name'],
            relations: {
              tokens: { picks: ['name'], where: { field: 'isActive', operator: 'equals', value: true } },
            },
          },
        },
      },
    };
    expect(lensWhere(nested, { spaces: { some: { tokens: { some: { name: 'x' } } } } })).toEqual({
      spaces: { some: { tokens: { some: { name: 'x', isActive: { equals: true } } } } },
    });
  });
});
