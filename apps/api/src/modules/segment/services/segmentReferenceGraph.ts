/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import type { Segment } from '@template/db/generated/client/client';
import { segmentLensFor } from '#/modules/segment/lib/segmentLens';
import { segmentReferences } from '#/modules/segment/services/segmentReferences';

export type ReferenceMap = Map<string, Set<string>>;

export const buildReferenceMap = (segments: Segment[]): ReferenceMap => {
  const map: ReferenceMap = new Map();
  for (const segment of segments) {
    if (!segment.conditions) {
      map.set(segment.id, new Set());
      continue;
    }
    const { ids } = segmentReferences(segment.conditions as Condition, segmentLensFor(segment.ownerModel));
    map.set(segment.id, new Set(ids));
  }
  return map;
};

export const findReferenceCycle = (references: ReferenceMap, start: string): string[] | null => {
  const settled = new Set<string>();
  const walk = (id: string, path: string[]): string[] | null => {
    if (settled.has(id) || path.includes(id)) return null;
    for (const next of references.get(id) ?? []) {
      if (next === start) return [...path, id, start];
      const found = walk(next, [...path, id]);
      if (found) return found;
    }
    settled.add(id);
    return null;
  };
  return walk(start, []);
};

export const sortByDependency = <T extends { id: string }>(segments: T[], references: ReferenceMap): T[] => {
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const ordered: T[] = [];
  const done = new Set<string>();
  const visiting = new Set<string>();

  const visit = (id: string): void => {
    if (done.has(id) || visiting.has(id)) return;
    visiting.add(id);
    for (const next of references.get(id) ?? []) if (byId.has(next)) visit(next);
    visiting.delete(id);
    done.add(id);
    const segment = byId.get(id);
    if (segment) ordered.push(segment);
  };

  for (const segment of segments) visit(segment.id);
  return ordered;
};

export const referencedBy = (references: ReferenceMap, id: string): string[] =>
  [...references.entries()].filter(([, targets]) => targets.has(id)).map(([owner]) => owner);
