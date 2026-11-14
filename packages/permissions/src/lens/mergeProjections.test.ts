import { describe, expect, it } from 'bun:test';
import { type LensNarrowing, Operator, projectRows, type Row } from '@inixiative/json-rules';
import { documentsLens } from '@template/permissions/lens/lensTestMap';
import { mergeProjections } from '@template/permissions/lens/mergeProjections';

const base = documentsLens();
const isPublic = { field: 'public', operator: Operator.equals, value: true };
const narrow = (root: LensNarrowing['root']): LensNarrowing => ({ parent: base, root });

describe('mergeProjections: objects match by id, never by position (Aron, 2026-11-14)', () => {
  it('C1: list items merge by id, so no item carries another item’s field', () => {
    const merged = mergeProjections(base, [
      { path: 'A', rows: [{ id: 'd', items: [{ id: 2, t: 'a' }] }] },
      {
        path: 'B',
        rows: [
          {
            id: 'd',
            items: [
              { id: 1, s: 'B' },
              { id: 2, s: 'C' },
            ],
          },
        ],
      },
    ]);
    expect(merged.rows).toEqual([
      {
        id: 'd',
        items: [
          { id: 2, t: 'a', s: 'C' },
          { id: 1, s: 'B' },
        ],
      },
    ]);
    expect(merged.rows[0]?.items).not.toContainEqual({ id: 2, t: 'a', s: 'B' });
  });

  it('C2: a to-one one path hides (null) yields to the path that shows it, in either order', () => {
    const hidden = { path: 'A', rows: [{ id: 'd', author: null }] };
    const shown = { path: 'B', rows: [{ id: 'd', author: { id: 'u', email: 'u@x' } }] };
    const expected = [{ id: 'd', author: { id: 'u', email: 'u@x' } }];
    expect(mergeProjections(base, [hidden, shown]).rows).toEqual(expected);
    expect(mergeProjections(base, [shown, hidden]).rows).toEqual(expected);
  });

  it('two paths showing different fields of one row give the row with both', () => {
    const merged = mergeProjections(base, [
      { path: 'A', rows: [{ id: 'd', title: 'T' }] },
      { path: 'B', rows: [{ id: 'd', body: 'B' }] },
    ]);
    expect(merged.rows).toEqual([{ id: 'd', title: 'T', body: 'B' }]);
  });

  it('a row only one path admits comes back as that path shows it, in order of first appearance', () => {
    const merged = mergeProjections(base, [
      { path: 'A', rows: [{ id: 'd1', title: 'one' }] },
      {
        path: 'B',
        rows: [
          { id: 'd2', body: 'two' },
          { id: 'd1', body: 'one' },
        ],
      },
    ]);
    expect(merged.rows).toEqual([
      { id: 'd1', title: 'one', body: 'one' },
      { id: 'd2', body: 'two' },
    ]);
  });

  it('lists nested two deep merge by id at every level', () => {
    const merged = mergeProjections(base, [
      { path: 'A', rows: [{ id: 'd', items: [{ id: 1, parts: [{ id: 10, n: 'a' }] }] }] },
      {
        path: 'B',
        rows: [
          {
            id: 'd',
            items: [
              {
                id: 1,
                parts: [
                  { id: 11, m: 'y' },
                  { id: 10, m: 'x' },
                ],
              },
              { id: 2, parts: [{ id: 10, m: 'other' }] },
            ],
          },
        ],
      },
    ]);
    expect(merged.rows).toEqual([
      {
        id: 'd',
        items: [
          {
            id: 1,
            parts: [
              { id: 10, n: 'a', m: 'x' },
              { id: 11, m: 'y' },
            ],
          },
          { id: 2, parts: [{ id: 10, m: 'other' }] },
        ],
      },
    ]);
  });

  it('Json kept by two paths must be equal: equal merges, different throws', () => {
    const meta = { tags: ['a'], nested: { n: 1 } };
    expect(
      mergeProjections(base, [
        { path: 'A', rows: [{ id: 'd', meta }] },
        { path: 'B', rows: [{ id: 'd', meta: structuredClone(meta) }] },
      ]).rows,
    ).toEqual([{ id: 'd', meta }]);
    expect(() =>
      mergeProjections(base, [
        { path: 'A', rows: [{ id: 'd', meta }] },
        { path: 'B', rows: [{ id: 'd', meta: { tags: ['b'] } }] },
      ]),
    ).toThrow('disagree on its value');
  });

  it('a scalar two paths disagree on throws', () => {
    expect(() =>
      mergeProjections(base, [
        { path: 'A', rows: [{ id: 'd', title: 'one' }] },
        { path: 'B', rows: [{ id: 'd', title: 'two' }] },
      ]),
    ).toThrow('Document[d].title');
  });

  it('an object without id in a model that has one throws, at the root and in a list', () => {
    expect(() => mergeProjections(base, [{ path: 'A', rows: [{ title: 'T' }] }])).toThrow(
      'a Document came back without its id',
    );
    expect(() =>
      mergeProjections(base, [
        { path: 'A', rows: [{ id: 'd', items: [{ id: 1 }] }] },
        { path: 'B', rows: [{ id: 'd', items: [{ t: 'a' }] }] },
      ]),
    ).toThrow('a Item came back without its id');
  });

  it('two to-ones with different ids on one row throw', () => {
    expect(() =>
      mergeProjections(base, [
        { path: 'A', rows: [{ id: 'd', author: { id: 'u1' } }] },
        { path: 'B', rows: [{ id: 'd', author: { id: 'u2' } }] },
      ]),
    ).toThrow('disagree on which Author');
  });

  it('a list of a model with no id is taken from the one path that carries it, and refused from two', () => {
    const logs = [{ at: '1', message: 'm' }];
    expect(
      mergeProjections(base, [
        { path: 'A', rows: [{ id: 'd', logs }] },
        { path: 'B', rows: [{ id: 'd', logs: [] }] },
      ]).rows,
    ).toEqual([{ id: 'd', logs }]);
    expect(() =>
      mergeProjections(base, [
        { path: 'A', rows: [{ id: 'd', logs }] },
        { path: 'B', rows: [{ id: 'd', logs }] },
      ]),
    ).toThrow('Log has no id');
  });

  it('does not change its inputs', () => {
    const left: Row[] = [{ id: 'd', items: [{ id: 1, t: 'a' }] }];
    const right: Row[] = [{ id: 'd', items: [{ id: 1, s: 'b' }] }];
    const before = structuredClone([left, right]);
    mergeProjections(base, [
      { path: 'A', rows: left },
      { path: 'B', rows: right },
    ]);
    expect([left, right]).toEqual(before);
  });
});

describe('attribution: every path that admitted an object, never billed (Aron, 2026-11-14)', () => {
  it('names a path that contributed one object and leaves out one whose filter admitted nothing', () => {
    const merged = mergeProjections(base, [
      {
        path: 'wide',
        rows: [
          { id: 'd1', title: 'one' },
          { id: 'd2', title: 'two' },
        ],
      },
      { path: 'one', rows: [{ id: 'd2', body: 'two' }] },
      { path: 'none', rows: [] },
    ]);
    expect(merged.attribution).toEqual(['wide', 'one']);
  });
});

describe('end to end through createLens and projectRows', () => {
  const source: Row[] = [
    {
      id: 'd1',
      title: 'one',
      body: 'secret',
      public: true,
      meta: { k: 1 },
      author: { id: 'u1', email: 'private@x', public: false },
      items: [
        { id: 1, t: 'a', s: 'x', public: true, parts: [{ id: 10, n: 'n10', m: 'm10' }] },
        { id: 2, t: 'b', s: 'B', public: false, parts: [{ id: 20, n: 'n20', m: 'm20' }] },
      ],
    },
    {
      id: 'd2',
      title: 'two',
      body: 'hidden',
      public: false,
      meta: { k: 2 },
      author: { id: 'u2', email: 'public@x', public: true },
      items: [],
    },
  ];

  const pathA = narrow({
    picks: ['id', 'title', 'meta'],
    relations: {
      author: { where: isPublic, picks: ['id', 'email'] },
      items: { where: isPublic, picks: ['id', 't'], relations: { parts: { picks: ['id', 'n'] } } },
    },
  });
  const pathB = narrow({
    where: isPublic,
    picks: ['id', 'body', 'meta'],
    relations: {
      author: { picks: ['id', 'email'] },
      items: { picks: ['id', 's'], relations: { parts: { picks: ['id', 'm'] } } },
    },
  });
  const pathNone = narrow({ where: { field: 'title', operator: Operator.equals, value: 'none' } });

  it('projectRows hides a filtered to-one as null and drops an omitted field, which the merge needs', () => {
    const [d1] = projectRows(pathA, source);
    expect(d1?.author).toBeNull();
    expect(d1).not.toHaveProperty('body');
    expect(d1?.items).toEqual([{ id: 1, t: 'a', parts: [{ id: 10, n: 'n10' }] }]);
  });

  it('merges the real projections by id, whatever the order of the paths', () => {
    const projections = [
      { path: 'A', rows: projectRows(pathA, source) },
      { path: 'B', rows: projectRows(pathB, source) },
      { path: 'none', rows: projectRows(pathNone, source) },
    ];
    const expected = [
      {
        id: 'd1',
        title: 'one',
        meta: { k: 1 },
        body: 'secret',
        author: { id: 'u1', email: 'private@x' },
        items: [
          { id: 1, t: 'a', s: 'x', parts: [{ id: 10, n: 'n10', m: 'm10' }] },
          { id: 2, s: 'B', parts: [{ id: 20, m: 'm20' }] },
        ],
      },
      {
        id: 'd2',
        title: 'two',
        meta: { k: 2 },
        author: { id: 'u2', email: 'public@x' },
        items: [],
      },
    ];
    const merged = mergeProjections(pathA, projections);
    expect(merged.rows).toEqual(expected);
    expect(merged.attribution).toEqual(['A', 'B']);
    expect(mergeProjections(pathA, [...projections].reverse()).rows).toEqual(expected);
  });
});
