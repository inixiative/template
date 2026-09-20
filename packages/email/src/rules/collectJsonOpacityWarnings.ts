/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { type EmailLens, walkEmailLensPath } from '@template/email/rules/emailLens';

const descendsBeneathJsonField = (path: string, lens: EmailLens): boolean =>
  walkEmailLensPath(path, lens).outcome === 'beneathJson';

export const collectJsonOpacityWarnings = (paths: string[], lens: EmailLens): string[] =>
  paths
    .filter((path) => descendsBeneathJsonField(path, lens))
    .map(
      (path) =>
        `"${path}" descends into a Json column's sub-structure, which save-time validation cannot see into — a typo here silently never matches at render (excluded, not failed) instead of failing the save. Double-check this path against the Json value's actual shape.`,
    );
