/**
 * @atlas
 * @kind helper
 * @partOf primitive:routeTemplates
 * @uses primitive:authz
 */
import { type ValidationIssue, validateRule } from '@inixiative/json-rules';
import { validateActionRule } from '@template/permissions/rebac';
import { isPlainObject } from 'lodash-es';
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
  body: { entitlements?: unknown; permissionRules?: unknown },
  ctx: z.RefinementCtx,
): void => {
  if (Array.isArray(body.entitlements))
    body.entitlements.forEach((entry: { where?: unknown }, index) => {
      if (entry.where !== undefined)
        report(
          ctx,
          ['entitlements', index, 'where'],
          validateRule(entry.where, { positive: true }).errors,
        );
    });
  if (isPlainObject(body.permissionRules))
    for (const [action, rule] of Object.entries(body.permissionRules as Record<string, unknown>))
      report(ctx, ['permissionRules', action], validateActionRule(rule).errors);
};
