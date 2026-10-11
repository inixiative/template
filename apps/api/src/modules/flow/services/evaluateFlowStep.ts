/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses primitive:routeTemplates
 */
import { bindRule, check, coerceRule } from '@inixiative/json-rules';
import { log } from '@template/shared/logger';
import type { Context } from 'hono';
import { readsRows, routeByOperationId } from '#/lib/routeTemplates/routeIndex';
import type { FlowCompletion } from '#/modules/flow/definitions/types';
import { readAsCaller } from '#/modules/flow/services/readAsCaller';
import { resolveBinds } from '#/modules/flow/services/resolveBinds';
import { responseLens } from '#/modules/flow/services/responseLens';
import type { AppEnv } from '#/types/appEnv';

export type FlowStepState = 'holds' | 'pending' | 'refused';

export const evaluateFlowStep = async (
  c: Context<AppEnv>,
  { read, path, query, rule }: FlowCompletion,
  bindings: Record<string, string>,
): Promise<FlowStepState> => {
  const route = routeByOperationId(read);
  const { resolveOperation } = await import('#/lib/openapi/resolveOperation');
  const operation = route && (await resolveOperation(read, resolveBinds(path, bindings)));
  if (!route || !operation) return 'refused';

  const boundRule = bindRule(rule, bindings);
  const search = new URLSearchParams(resolveBinds(query, bindings));
  const refused = (response: Response): FlowStepState => {
    if (response.status !== 403 && response.status !== 404)
      log.warn(`flow step read "${read}" answered ${response.status}`);
    return 'refused';
  };

  if (readsRows(route)) {
    search.set('pageSize', '1');
    const response = await readAsCaller(c, `${operation.path}?${search}`, {
      root: { where: coerceRule(boundRule, route.filterLens) },
    });
    if (!response.ok) return refused(response);
    const { pagination } = (await response.json()) as { pagination: { total: number } };
    return pagination.total > 0 ? 'holds' : 'pending';
  }

  const response = await readAsCaller(
    c,
    search.size ? `${operation.path}?${search}` : operation.path,
  );
  if (!response.ok || !route.responseSchema) return refused(response);
  const { data } = (await response.json()) as { data: Record<string, unknown> };
  const typedRule = coerceRule(boundRule, responseLens(route.responseSchema, read));
  return check(typedRule, data) === true ? 'holds' : 'pending';
};
