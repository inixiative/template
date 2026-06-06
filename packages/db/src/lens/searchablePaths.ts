import { type FieldMapEntry, type LensNarrowing, type NarrowingDefaults, projectByPath } from '@inixiative/json-rules';
import { HOOK_REDACT_FIELDS } from '@template/db/registries/redactFields';

// Each projectByPath entry maps a dotted lens-anchored path to the per-visit projection.
// `fields` is keyed by field name; entries carry the same shape as a FieldMap field.
type Visit = { fields: Record<string, FieldMapEntry> };

const redactionDefaults: NarrowingDefaults = {
  models: Object.fromEntries(Object.entries(HOOK_REDACT_FIELDS).map(([model, omits]) => [model, { omits }])),
};

export const searchablePaths = (filterLens: LensNarrowing): string[] => {
  const narrowed: LensNarrowing = { parent: filterLens, mapDefaults: { prisma: redactionDefaults } };
  const byPath = projectByPath(narrowed) as Map<string, Visit>;
  const paths: string[] = [];
  // First entry is always the root anchor — strip its prefix from nested paths so
  // callers get `sourceUser.name` rather than `Inquiry.sourceUser.name`.
  const rootKey = byPath.keys().next().value;
  if (!rootKey) return paths;
  for (const [dottedPath, visit] of byPath) {
    const prefix = dottedPath === rootKey ? '' : dottedPath.slice(rootKey.length + 1);
    for (const [fieldName, entry] of Object.entries(visit.fields)) {
      if (entry.kind === 'scalar' || entry.kind === 'enum') {
        paths.push(prefix ? `${prefix}.${fieldName}` : fieldName);
      }
    }
  }
  return paths;
};
