/**
 * @atlas
 * @kind service
 * @partOf primitive:batch
 * @uses none
 */
import type { Context } from 'hono';
import { registerBatch, unregisterBatch } from '#/modules/batch/services/batchRegistry';
import { executeRequest } from '#/modules/batch/services/strategies/executeRequest';
import type { RequestResult } from '#/modules/batch/services/strategies/types';
import type { AppEnv } from '#/types/appEnv';

export const readAsCaller = async (c: Context<AppEnv>, path: string): Promise<RequestResult> => {
  const batchId = crypto.randomUUID();
  registerBatch(batchId, c.get('db'), c);
  try {
    return await executeRequest(c.get('app'), { method: 'GET', path }, batchId, {}, c.req.raw);
  } finally {
    unregisterBatch(batchId);
  }
};
