import { describe, expect, it } from 'bun:test';
import {
  findReferenceCycle,
  type ReferenceMap,
  referencedBy,
  sortByDependency,
} from '#/modules/segment/services/segmentReferenceGraph';

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

  it('names the loop when a cycle passes through the start', () => {
    const references = graph({ a: ['b'], b: ['c'], c: ['a'] });
    expect(findReferenceCycle(references, 'a')).toEqual(['a', 'b', 'c', 'a']);
    expect(findReferenceCycle(references, 'b')).toEqual(['b', 'c', 'a', 'b']);
  });

  it('returns null when the start is not on a loop, even if one exists elsewhere', () => {
    const references = graph({ a: ['b'], b: ['c'], c: ['b'], d: [] });
    expect(findReferenceCycle(references, 'd')).toBeNull();
    expect(findReferenceCycle(references, 'a')).toBeNull();
  });

  it('answers who references a segment', () => {
    const references = graph({ a: ['c'], b: ['c'], c: [] });
    expect(referencedBy(references, 'c').sort()).toEqual(['a', 'b']);
    expect(referencedBy(references, 'a')).toEqual([]);
  });
});
