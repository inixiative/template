/**
 * @atlas
 * @kind helper
 * @partOf infrastructure:prisma
 * @uses none
 */
import { getLensRoot, type LensNarrowing, projectLens } from '@inixiative/json-rules';
import { redactLens } from '@template/db/lens/redactLens';

export const searchablePaths = (filterLens: LensNarrowing): string[] => {
  const rootKey = getLensRoot(filterLens).model;
  const paths: string[] = [];
  for (const [dottedPath, visit] of Object.entries(projectLens(redactLens(filterLens)))) {
    const prefix = dottedPath === rootKey ? '' : dottedPath.slice(rootKey.length + 1);
    for (const [fieldName, entry] of Object.entries(visit.fields)) {
      if (entry.kind === 'scalar' || entry.kind === 'enum') {
        paths.push(prefix ? `${prefix}.${fieldName}` : fieldName);
      }
    }
  }
  return paths;
};
