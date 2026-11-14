import { describe, expect, it } from 'bun:test';
import { type LensNarrowing, Operator, projectRows, type Row } from '@inixiative/json-rules';
import { mergeProjections } from '@template/permissions/lens/mergeProjections';
import { documentsLens } from '@template/permissions/test/documentsLens';

const base = documentsLens();
const isPublic = { field: 'public', operator: Operator.equals, value: true };
const narrow = (root: LensNarrowing['root']): LensNarrowing => ({ parent: base, root });
const everything = narrow({
  relations: { author: {}, items: { relations: { parts: {} } }, logs: {} },
});
const shown = (path: string, rows: Row[]) => ({ path, lens: everything, rows });

describe('mergeProjections: objects match by id, never by position (Aron, 2026-11-14)', () => {
  it('C1: list items merge by id, so no item carries another item’s field', () => {
    const source = [
      {
        id: 'd',
        items: [
          { id: 1, t: 'x', s: 'B' },
          { id: 2, t: 'a', s: 'C' },
        ],
      },
    ];
    const merged = mergeProjections(source, [
      shown('A', [{ id: 'd', items: [{ id: 2, t: 'a' }] }]),
      shown('B', [
        {
          id: 'd',
          items: [
            { id: 1, s: 'B' },
            { id: 2, s: 'C' },
          ],
        },
      ]),
    ]);
    expect(merged.rows).toEqual([
      {
        id: 'd',
        items: [
          { id: 1, s: 'B' },
          { id: 2, t: 'a', s: 'C' },
        ],
      },
    ]);
    expect(merged.rows[0]?.items).not.toContainEqual({ id: 2, t: 'a', s: 'B' });
  });

  it('C2: a to-one one path hides (null) yields to the path that shows it, in either order', () => {
    const source = [{ id: 'd', author: { id: 'u', email: 'u@x' } }];
    const hidden = shown('A', [{ id: 'd', author: null }]);
    const visible = shown('B', [{ id: 'd', author: { id: 'u', email: 'u@x' } }]);
    const expected = [{ id: 'd', author: { id: 'u', email: 'u@x' } }];
    expect(mergeProjections(source, [hidden, visible]).rows).toEqual(expected);
    expect(mergeProjections(source, [visible, hidden]).rows).toEqual(expected);
  });

  it('two paths showing different fields of one row give the row with both', () => {
    const merged = mergeProjections(
      [{ id: 'd', title: 'T', body: 'B' }],
      [shown('A', [{ id: 'd', title: 'T' }]), shown('B', [{ id: 'd', body: 'B' }])],
    );
    expect(merged.rows).toEqual([{ id: 'd', title: 'T', body: 'B' }]);
  });

  it('a row only one path admits comes back as that path shows it', () => {
    const merged = mergeProjections(
      [
        { id: 'd1', title: 'one', body: 'one' },
        { id: 'd2', title: 'two', body: 'two' },
      ],
      [
        shown('A', [{ id: 'd1', title: 'one' }]),
        shown('B', [
          { id: 'd2', body: 'two' },
          { id: 'd1', body: 'one' },
        ]),
      ],
    );
    expect(merged.rows).toEqual([
      { id: 'd1', title: 'one', body: 'one' },
      { id: 'd2', body: 'two' },
    ]);
  });

  it('lists nested two deep merge by id at every level, in source order', () => {
    const source = [
      {
        id: 'd',
        items: [
          {
            id: 1,
            parts: [
              { id: 10, n: 'a', m: 'x' },
              { id: 11, n: 'b', m: 'y' },
            ],
          },
          { id: 2, parts: [{ id: 10, n: 'c', m: 'other' }] },
        ],
      },
    ];
    const merged = mergeProjections(source, [
      shown('A', [{ id: 'd', items: [{ id: 1, parts: [{ id: 10, n: 'a' }] }] }]),
      shown('B', [
        {
          id: 'd',
          items: [
            { id: 2, parts: [{ id: 10, m: 'other' }] },
            {
              id: 1,
              parts: [
                { id: 11, m: 'y' },
                { id: 10, m: 'x' },
              ],
            },
          ],
        },
      ]),
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
    const source = [{ id: 'd', meta }];
    expect(
      mergeProjections(source, [
        shown('A', [{ id: 'd', meta }]),
        shown('B', [{ id: 'd', meta: structuredClone(meta) }]),
      ]).rows,
    ).toEqual([{ id: 'd', meta }]);
    expect(() =>
      mergeProjections(source, [
        shown('A', [{ id: 'd', meta }]),
        shown('B', [{ id: 'd', meta: { tags: ['b'] } }]),
      ]),
    ).toThrow('disagree on its value');
  });

  it('a scalar two paths disagree on throws', () => {
    expect(() =>
      mergeProjections(
        [{ id: 'd', title: 'one' }],
        [shown('A', [{ id: 'd', title: 'one' }]), shown('B', [{ id: 'd', title: 'two' }])],
      ),
    ).toThrow('root[d].title');
  });

  it('an object without id in a model that has one throws, at the root and in a list', () => {
    expect(() => mergeProjections([{ id: 'd' }], [shown('A', [{ title: 'T' }])])).toThrow(
      'a Document came back without its id',
    );
    expect(() =>
      mergeProjections(
        [{ id: 'd', items: [{ id: 1, t: 'a' }] }],
        [
          shown('A', [{ id: 'd', items: [{ id: 1 }] }]),
          shown('B', [{ id: 'd', items: [{ t: 'a' }] }]),
        ],
      ),
    ).toThrow('a Item came back without its id');
  });

  it('an object the source rows do not carry throws', () => {
    expect(() => mergeProjections([{ id: 'd1' }], [shown('A', [{ id: 'd2' }])])).toThrow(
      'the source rows do not',
    );
  });

  it('a list of a model with no id is taken from the one path that carries it, and refused from two', () => {
    const logs = [{ at: '1', message: 'm' }];
    const source = [{ id: 'd', logs }];
    expect(
      mergeProjections(source, [
        shown('A', [{ id: 'd', logs }]),
        shown('B', [{ id: 'd', logs: [] }]),
      ]).rows,
    ).toEqual([{ id: 'd', logs }]);
    expect(() =>
      mergeProjections(source, [shown('A', [{ id: 'd', logs }]), shown('B', [{ id: 'd', logs }])]),
    ).toThrow('Log has no id');
  });

  it('neither changes its inputs nor shares an object with them', () => {
    const source = [
      { id: 'd', meta: { k: 1 }, items: [{ id: 1, t: 'a', s: 'b' }], logs: [{ at: '1' }] },
    ];
    const left: Row[] = [
      { id: 'd', meta: { k: 1 }, items: [{ id: 1, t: 'a' }], logs: [{ at: '1' }] },
    ];
    const right: Row[] = [{ id: 'd', items: [{ id: 1, s: 'b' }] }];
    const before = structuredClone([source, left, right]);
    const [merged] = mergeProjections(source, [shown('A', left), shown('B', right)]).rows;
    expect([source, left, right]).toEqual(before);
    (merged?.meta as Row).k = 2;
    (merged?.logs as Row[]).push({ at: '2' });
    expect([source, left, right]).toEqual(before);
  });
});

describe('order follows the source rows, never the order of the paths', () => {
  const source: Row[] = [
    {
      id: 'd1',
      title: 'one',
      public: false,
      items: [
        { id: 1, t: 'a', public: false },
        { id: 2, t: 'b', public: true },
      ],
    },
    { id: 'd2', title: 'two', public: true, items: [] },
  ];
  const onlyPublic = narrow({
    where: isPublic,
    picks: ['id', 'title'],
    relations: { items: { picks: ['id', 't'] } },
  });
  const unfiltered = narrow({ picks: ['id', 'title'], relations: { items: { picks: ['id'] } } });
  const publicItems = narrow({
    picks: ['id'],
    relations: { items: { where: isPublic, picks: ['id', 't'] } },
  });
  const projection = (path: string, lens: LensNarrowing) => ({
    path,
    lens,
    rows: projectRows(lens, source),
  });

  it('at the root: [d1 private, d2 public] comes back d1, d2 in both path orders', () => {
    const paths = [projection('A', onlyPublic), projection('B', unfiltered)];
    for (const ordered of [paths, [...paths].reverse()])
      expect(mergeProjections(source, ordered).rows.map((row) => row.id)).toEqual(['d1', 'd2']);
  });

  it('in a nested list: [1 private, 2 public] comes back 1, 2 in both path orders', () => {
    const paths = [projection('A', publicItems), projection('B', unfiltered)];
    for (const ordered of [paths, [...paths].reverse()])
      expect(mergeProjections(source, ordered).rows[0]?.items).toEqual([
        { id: 1 },
        { id: 2, t: 'b' },
      ]);
  });
});

describe('attribution: every path that admitted an object, never billed (Aron, 2026-11-14)', () => {
  it('names a path that contributed one object and leaves out one whose filter admitted nothing', () => {
    const merged = mergeProjections(
      [
        { id: 'd1', title: 'one' },
        { id: 'd2', title: 'two', body: 'two' },
      ],
      [
        shown('wide', [
          { id: 'd1', title: 'one' },
          { id: 'd2', title: 'two' },
        ]),
        shown('one', [{ id: 'd2', body: 'two' }]),
        shown('none', []),
      ],
    );
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
      { path: 'A', lens: pathA, rows: projectRows(pathA, source) },
      { path: 'B', lens: pathB, rows: projectRows(pathB, source) },
      { path: 'none', lens: pathNone, rows: projectRows(pathNone, source) },
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
    const merged = mergeProjections(source, projections);
    expect(merged.rows).toEqual(expected);
    expect(merged.attribution).toEqual(['A', 'B']);
    expect(mergeProjections(source, [...projections].reverse()).rows).toEqual(expected);
  });
});
