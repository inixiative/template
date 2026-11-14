import { describe, expect, it } from 'bun:test';
import { documentsLens } from '@template/permissions/lens/lensTestMap';
import { narrowingsDroppingId } from '@template/permissions/lens/narrowingsDroppingId';

const base = documentsLens();

describe('a lens never removes id (Aron, 2026-11-14)', () => {
  it('passes a lens that keeps id everywhere, and one with no picks or omits', () => {
    expect(
      narrowingsDroppingId(base, {
        root: {
          picks: ['id', 'title'],
          relations: { items: { omits: ['t'], relations: { parts: { picks: ['id'] } } } },
        },
        mapDefaults: { docs: { models: { Author: { omits: ['email'] } } } },
      }),
    ).toEqual([]);
    expect(narrowingsDroppingId(base, {})).toEqual([]);
  });

  it('names the root when it omits id or picks without it', () => {
    expect(narrowingsDroppingId(base, { root: { omits: ['id'] } })).toEqual(['root']);
    expect(narrowingsDroppingId(base, { root: { picks: ['title'] } })).toEqual(['root']);
  });

  it('names every nested relation and mapDefaults model that drops id', () => {
    expect(
      narrowingsDroppingId(base, {
        root: {
          relations: {
            author: { picks: ['email'] },
            items: { picks: ['id'], relations: { parts: { omits: ['id'] } } },
          },
        },
        mapDefaults: { docs: { models: { Item: { picks: ['t'] } } } },
      }),
    ).toEqual([
      'root.relations.author',
      'root.relations.items.relations.parts',
      'mapDefaults.docs.models.Item',
    ]);
  });

  it('does not enforce id on a model whose field map has none', () => {
    expect(
      narrowingsDroppingId(base, {
        root: { relations: { logs: { picks: ['message'] } } },
        mapDefaults: { docs: { models: { Log: { omits: ['at'] } } } },
      }),
    ).toEqual([]);
    expect(narrowingsDroppingId(documentsLens('Log'), { root: { picks: ['message'] } })).toEqual(
      [],
    );
  });
});
