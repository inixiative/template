/**
 * Tiny browser-side helper that mirrors `apps/api`'s server-side
 * `isStringPath` — answers "does this dotted path resolve to a String
 * field on this model?" — by reading the generated `prismaMap`.
 *
 * Used only by `broadcastSearch` to filter caller-provided paths down to
 * string scalars before fanning out a `contains` OR. We could reuse the
 * server's `fieldMetadata` helpers, but `apps/api` can't be imported from
 * `packages/ui`, and the broadcast filter only needs one yes/no answer —
 * not the full operator-validation surface the server uses.
 */

import { prismaMap } from '@template/permissions/rebac/prismaMap.gen';

type FieldDef = { kind: 'scalar' | 'enum' | 'object'; type: string };

// One cast at module boundary — see apps/api/src/lib/prisma/fieldMetadata.ts
// for rationale.
const MAP = prismaMap as Record<string, { fields: Record<string, FieldDef> }>;

const lookupField = (modelName: string, path: string): FieldDef | undefined => {
  const segments = path.split('.');
  let currentModel: string | undefined = modelName;
  for (let i = 0; i < segments.length; i += 1) {
    if (!currentModel) return undefined;
    const field: FieldDef | undefined = MAP[currentModel]?.fields?.[segments[i]];
    if (!field) return undefined;
    if (i === segments.length - 1) return field;
    if (field.kind !== 'object') return undefined;
    currentModel = field.type;
  }
  return undefined;
};

export const isStringPath = (modelName: string, path: string): boolean => {
  const field = lookupField(modelName, path);
  return field?.kind === 'scalar' && field.type === 'String';
};
