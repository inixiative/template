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

const reportWheres = (ctx: z.RefinementCtx, path: (string | number)[], entries: unknown) => {
  if (Array.isArray(entries))
    entries.forEach((entry: { where?: unknown }, index) => {
      if (entry.where !== undefined)
        report(
          ctx,
          [...path, index, 'where'],
          validateRule(entry.where, { positive: true }).errors,
        );
    });
};

const isEntitlement = (body: unknown): body is { sourceModel: unknown; where?: unknown } =>
  typeof body === 'object' && body !== null && 'sourceModel' in body;

/** Entitlements carry positive rules only: one row of a many body, or a delegate's `entitlements`. */
export const permissionsBodyRefinement = (body: unknown, ctx: z.RefinementCtx): void => {
  if (isEntitlement(body)) {
    if (body.where !== undefined)
      report(ctx, ['where'], validateRule(body.where, { positive: true }).errors);
  } else reportWheres(ctx, ['entitlements'], (body as { entitlements?: unknown }).entitlements);
};
