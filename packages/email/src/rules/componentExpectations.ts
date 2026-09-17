/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import type { Lens, LensNarrowing } from '@inixiative/json-rules';
import { SYSTEM_TOKENS } from '@template/email/render/systemTokens';
import { collectHydrationPaths } from '@template/email/rules/collectHydrationPaths';
import { isRailProvidedSystemField } from '@template/email/rules/railProvidedSystemFields';
import { walkLensPath } from '@template/email/rules/walkLensPath';

export const deriveComponentExpectations = (mjml: string): string[] =>
  [...collectHydrationPaths(mjml).fieldPaths].sort();

const SYSTEM_TOKEN_NAMES = new Set<string>(SYSTEM_TOKENS.map(({ name }) => name));

export type ExpectationCheck = { path: string; ok: boolean };

const pathResolves = (path: string, lens: Lens | LensNarrowing): boolean => {
  const [root, ...rest] = path.split('.');
  if (root === 'system') {
    const name = rest[0] ?? '';
    return rest.length === 1 && (SYSTEM_TOKEN_NAMES.has(name) || isRailProvidedSystemField(name));
  }

  const { outcome } = walkLensPath(path, lens);
  return outcome === 'resolved' || outcome === 'beneathJson';
};

export const checkExpectations = (expectations: readonly string[], lens: Lens | LensNarrowing): ExpectationCheck[] =>
  expectations.map((path) => ({ path, ok: pathResolves(path, lens) }));

export const collectUnprovidedPathWarnings = (fieldPaths: readonly string[], lens: Lens | LensNarrowing): string[] =>
  checkExpectations(fieldPaths, lens)
    .filter((check) => !check.ok)
    .map(
      (check) =>
        `"{{${check.path}}}" isn't provided by this template's rule surface — it will render as literal text in the delivered email`,
    );
