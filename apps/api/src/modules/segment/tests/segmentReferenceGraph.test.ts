import { describe, expect, it } from 'bun:test';
import type { ReferenceMap } from '@template/shared/graph';
import { referencedBy, sortByDependency } from '#/modules/segment/services/segmentReferenceGraph';

const graph = (edges: Record<string, string[]>): ReferenceMap =>
  new Map(Object.entries(edges).map(([id, targets]) => [id, new Set(targets)]));

describe('segmentReferenceGraph', () => {
  it('orders referenced segments before the segments that reference them', () => {
    const references = graph({ c: ['b'], b: ['a'], a: [] });
    const ordered = sortByDependency([{ id: 'c' }, { id: 'b' }, { id: 'a' }], references);
    expect(ordered.map((segment) => segment.id)).toEqual(['a', 'b', 'c']);
  });

  it('keeps segments that reference nothing in their given order', () => {
    const ordered = sortByDependency([{ id: 'x' }, { id: 'y' }], graph({ x: [], y: [] }));
    expect(ordered.map((segment) => segment.id)).toEqual(['x', 'y']);
  });

  it('answers who references a segment', () => {
    const references = graph({ a: ['c'], b: ['c'], c: [] });
    expect(referencedBy(references, 'c').sort()).toEqual(['a', 'b']);
    expect(referencedBy(references, 'a')).toEqual([]);
  });
});
