/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses primitive:batch, primitive:routeTemplates
 */
import { bindRule } from '@inixiative/json-rules';
import { db } from '@template/db';
import type { Context } from 'hono';
import { mapValues } from 'lodash-es';
import { registerBatch, unregisterBatch } from '#/modules/batch/services/batchRegistry';
import type { FlowCompletion } from '#/modules/flow/definitions/types';
import { fillFlowTemplate } from '#/modules/flow/services/fillFlowTemplate';
import type { AppEnv } from '#/types/appEnv';

export const countFlowStepRows = async (
  c: Context<AppEnv>,
  completion: FlowCompletion,
  bindings: Record<string, string>,
): Promise<number | null> => {
  const { resolveOperation } = await import('#/lib/openapi/resolveOperation');
  const pathParams = mapValues(completion.path ?? {}, (template) =>
    fillFlowTemplate(template, bindings, String),
  );
  const operation = await resolveOperation(completion.read, pathParams);
  if (!operation) return null;

  const batchId = crypto.randomUUID();
  const narrowing = completion.where
    ? { root: { where: bindRule(completion.where, bindings) } }
    : undefined;
  registerBatch(batchId, db, c, narrowing);
  try {
    const response = await c
      .get('app')
      .request(`${operation.path}?pageSize=1`, { headers: { 'x-batch-id': batchId } });
    if (!response.ok) return null;
    const body = (await response.json()) as { pagination?: { total?: number } };
    return body.pagination?.total ?? null;
  } finally {
    unregisterBatch(batchId);
  }
};
