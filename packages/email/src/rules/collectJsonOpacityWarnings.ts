/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import { walkLensPath } from '@template/email/rules/walkLensPath';

const descendsBeneathJsonField = (path: string, lens: Lens | LensNarrowing): boolean =>
  walkLensPath(path, lens).outcome === 'beneathJson';

export const collectJsonOpacityWarnings = (paths: string[], lens: Lens | LensNarrowing): string[] =>
  paths
    .filter((path) => descendsBeneathJsonField(path, lens))
    .map(
      (path) =>
        `"${path}" descends into a Json column's sub-structure, which save-time validation cannot see into — a typo here silently never matches at render (excluded, not failed) instead of failing the save. Double-check this path against the Json value's actual shape.`,
    );
