/**
 * @atlas
 * @kind service
 * @partOf feature:segment
 * @uses none
 */
import type { Condition } from '@inixiative/json-rules';
import { ruleReferences } from '@template/db';
import type { Segment } from '@template/db/generated/client/client';
import type { ReferenceMap } from '@template/shared/graph';
import { customerRefLens } from '#/modules/customerRef/lib/customerRefLens';

export const buildReferenceMap = (segments: Segment[]): ReferenceMap => {
  const map: ReferenceMap = new Map();
  for (const segment of segments) {
    if (!segment.conditions) {
      map.set(segment.id, new Set());
      continue;
    }
    map.set(
      segment.id,
      new Set(
        ruleReferences(customerRefLens, segment.conditions as Condition)
          .filter((reference) => reference.model === 'Segment')
          .map((reference) => reference.id),
      ),
    );
  }
  return map;
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

export const referencedBy = (references: ReferenceMap, id: string): string[] =>
  [...references.entries()].filter(([, targets]) => targets.has(id)).map(([owner]) => owner);
