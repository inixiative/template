import { describe, expect, it } from 'bun:test';
import type { LensNarrowing } from '@inixiative/json-rules';
import { listLensPathsThatDropId } from '@template/permissions/lens/listLensPathsThatDropId';
import { documentsLens } from '@template/permissions/test/documentsLens';

const over = (lens: Omit<LensNarrowing, 'parent'>, model = 'Document'): LensNarrowing => ({
  parent: documentsLens(model),
  ...lens,
});

describe('a lens never removes id (Aron, 2026-11-14)', () => {
  it('passes a lens that keeps id everywhere, and one with no picks or omits', () => {
    expect(
      listLensPathsThatDropId(
        over({
          root: {
            picks: ['id', 'title'],
            relations: { items: { omits: ['t'], relations: { parts: { picks: ['id'] } } } },
          },
          mapDefaults: { docs: { models: { Author: { omits: ['email'] } } } },
        }),
      ),
    ).toEqual([]);
    expect(listLensPathsThatDropId(over({}))).toEqual([]);
  });

  it('names the root when it omits id or picks without it', () => {
    expect(listLensPathsThatDropId(over({ root: { omits: ['id'] } }))).toEqual(['Document']);
    expect(listLensPathsThatDropId(over({ root: { picks: ['title'] } }))).toEqual(['Document']);
  });

  it('names every nested relation that does not show id', () => {
    expect(
      listLensPathsThatDropId(
        over({
          root: {
            relations: {
              author: { picks: ['email'] },
              items: { picks: ['id'], relations: { parts: { omits: ['id'] } } },
            },
          },
        }),
      ),
    ).toEqual(['Document.author', 'Document.items.parts']);
  });

  it('names a mapDefaults model that drops id, reached or not, and where it reaches it', () => {
    expect(
      listLensPathsThatDropId(
        over({ mapDefaults: { docs: { models: { Item: { picks: ['t'] } } } } }),
      ),
    ).toEqual(['mapDefaults.docs.models.Item']);
    expect(
      listLensPathsThatDropId(
        over({
          root: { relations: { items: {} } },
          mapDefaults: { docs: { models: { Item: { omits: ['id'] } } } },
        }),
      ),
    ).toEqual(['Document.items', 'mapDefaults.docs.models.Item']);
    expect(
      listLensPathsThatDropId(
        over({
          mapDefaults: {
            docs: { models: { Item: { relations: { parts: { picks: ['n'] } } } } },
          },
        }),
      ),
    ).toEqual(['mapDefaults.docs.models.Item.parts']);
  });

  it('does not enforce id on a model whose field map has none', () => {
    expect(
      listLensPathsThatDropId(
        over({
          root: { relations: { logs: { picks: ['message'] } } },
          mapDefaults: { docs: { models: { Log: { omits: ['at'] } } } },
        }),
      ),
    ).toEqual([]);
    expect(listLensPathsThatDropId(over({ root: { picks: ['message'] } }, 'Log'))).toEqual([]);
  });
});
