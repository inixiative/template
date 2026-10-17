import { describe, expect, it } from 'bun:test';
import { findReferenceCycle, type ReferenceMap } from '@template/shared/graph';

const graph = (edges: Record<string, string[]>): ReferenceMap =>
  new Map(Object.entries(edges).map(([id, targets]) => [id, new Set(targets)]));

describe('findReferenceCycle', () => {
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
});
