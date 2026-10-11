/**
 * @atlas
 * @kind service
 * @partOf primitive:flows
 * @uses primitive:batch
 */
import { db } from '@template/db';
import type { Context } from 'hono';
import type { WhereScope } from '#/middleware/resources/scopeNarrowing';
import { registerBatch, unregisterBatch } from '#/modules/batch/services/batchRegistry';
import type { AppEnv } from '#/types/appEnv';

export const readAsCaller = async (
  c: Context<AppEnv>,
  path: string,
  narrowing?: WhereScope,
): Promise<Response> => {
  const batchId = crypto.randomUUID();
  registerBatch(batchId, db, c, narrowing);
  try {
    return await c.get('app').request(path, { headers: { 'x-batch-id': batchId } });
  } finally {
    unregisterBatch(batchId);
  }
};
