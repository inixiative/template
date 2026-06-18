/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { type Lens, type LensNarrowing, projectByPath } from '@inixiative/json-rules';

export type IncludeTree = { [relation: string]: true | { include: IncludeTree } };

export const includeFromLens = (lens: Lens | LensNarrowing): IncludeTree | undefined => {
  const byPath = projectByPath(lens);

  const build = (path: string): IncludeTree | undefined => {
    const visit = byPath.get(path);
    if (!visit) return undefined;

    const include: IncludeTree = {};
    for (const [name, entry] of Object.entries(visit.fields)) {
      if (entry.kind !== 'object') continue;
      const nested = byPath.has(`${path}.${name}`) ? build(`${path}.${name}`) : undefined;
      include[name] = nested ? { include: nested } : true;
    }
    return Object.keys(include).length > 0 ? include : undefined;
  };

  const [rootKey] = byPath.keys();
  return rootKey ? build(rootKey) : undefined;
};
