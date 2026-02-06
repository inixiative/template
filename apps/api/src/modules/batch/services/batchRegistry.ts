import type { Context } from 'hono';
import type { Db } from '@template/db';
import { refreshUserContext } from '#/lib/context/refreshUserContext';
import type { AppEnv } from '#/types/appEnv';

type BatchContext = {
  txn: Db;
  baseContext: Context<AppEnv>;
  baseHeaders: Record<string, string>;
};

const registry = new Map<string, BatchContext>();

export const registerBatch = (batchId: string, txn: Db, baseContext: Context<AppEnv>): void => {
  const baseHeaders: Record<string, string> = {};
  baseContext.req.raw.headers.forEach((value, key) => {
    baseHeaders[key] = value;
  });

  registry.set(batchId, { txn, baseContext, baseHeaders });
};

export const getBatchContext = (batchId: string): BatchContext | undefined => {
  return registry.get(batchId);
};

export const unregisterBatch = (batchId: string): void => {
  registry.delete(batchId);
};

export const refreshBatchContext = async (batchId: string): Promise<void> => {
  const batch = registry.get(batchId);
  if (!batch) return;

  const { txn, baseContext } = batch;
  await refreshUserContext(baseContext, txn);
};
