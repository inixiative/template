/**
 * @atlas
 * @kind helper
 * @partOf primitive:routeTemplates
 * @uses primitive:authz
 */
import { type ValidationIssue, validateRule } from '@inixiative/json-rules';
import type { z } from 'zod';

const report = (
  ctx: z.RefinementCtx,
  path: (string | number)[],
  errors: ValidationIssue[],
): void => {
  for (const error of errors)
    ctx.addIssue({ code: 'custom', path, message: `${error.path}: ${error.message}` });
};

export const permissionsBodyRefinement = (
  body: { entitlements?: unknown; add?: unknown; remove?: unknown },
  ctx: z.RefinementCtx,
): void => {
  for (const key of ['entitlements', 'add', 'remove'] as const) {
    const entries = body[key];
    if (Array.isArray(entries))
      entries.forEach((entry: { where?: unknown }, index) => {
        if (entry.where !== undefined)
          report(ctx, [key, index, 'where'], validateRule(entry.where, { positive: true }).errors);
      });
  }
};
