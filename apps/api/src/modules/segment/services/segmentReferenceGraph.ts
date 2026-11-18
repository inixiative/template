/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { ruleReferences } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import { customerRelationshipLens } from '#/modules/customerRelationship/lib/lenses/customerRelationshipLens';

export type ReferenceMap = Map<string, Set<string>>;

export const targetSegmentIdsBySegmentId = (segments: Segment[]): ReferenceMap => {
  const map: ReferenceMap = new Map();
  for (const segment of segments) {
    if (!segment.conditions) {
      map.set(segment.id, new Set());
      continue;
    }
    map.set(
      segment.id,
      new Set(
        ruleReferences(customerRelationshipLens, segment.conditions as Condition)
          .filter((reference) => reference.model === 'Segment')
          .map((reference) => reference.id),
      ),
    );
  }
  return map;
};

export const findReferenceCycle = (references: ReferenceMap, start: string): string[] | null => {
  const fullyExploredIds = new Set<string>();
  const walk = (id: string, path: string[]): string[] | null => {
    if (fullyExploredIds.has(id) || path.includes(id)) return null;
    for (const next of references.get(id) ?? []) {
      if (next === start) return [...path, id, start];
      const found = walk(next, [...path, id]);
      if (found) return found;
    }
    fullyExploredIds.add(id);
    return null;
  };
  return walk(start, []);
};

export const sortByDependency = <T extends { id: string }>(
  segments: T[],
  references: ReferenceMap,
): T[] => {
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

export const segmentIdsReferencingSegment = (references: ReferenceMap, id: string): string[] =>
  [...references.entries()].filter(([, targets]) => targets.has(id)).map(([owner]) => owner);
