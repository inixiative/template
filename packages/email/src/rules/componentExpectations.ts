/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import { collectHydrationPaths } from '@template/email/rules/collectHydrationPaths';
import { type EmailLens, walkEmailLensPath } from '@template/email/rules/emailLens';

export const deriveComponentExpectations = (mjml: string): string[] =>
  [...collectHydrationPaths(mjml).fieldPaths].sort();

export type ExpectationCheck = { path: string; ok: boolean };

const pathResolves = (path: string, lens: EmailLens): boolean => {
  const { outcome } = walkEmailLensPath(path, lens);
  return outcome === 'resolved' || outcome === 'beneathJson';
};

export const checkExpectations = (expectations: readonly string[], lens: EmailLens): ExpectationCheck[] =>
  expectations.map((path) => ({ path, ok: pathResolves(path, lens) }));

export const collectUnprovidedPathWarnings = (fieldPaths: readonly string[], lens: EmailLens): string[] =>
  checkExpectations(fieldPaths, lens)
    .filter((check) => !check.ok)
    .map(
      (check) =>
        `"{{${check.path}}}" isn't provided by this template's rule surface — it will render as literal text in the delivered email`,
    );
