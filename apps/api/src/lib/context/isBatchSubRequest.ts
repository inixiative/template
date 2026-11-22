/**
 * @atlas
 * @kind utils
 * @partOf primitive:requestContext
 * @uses none
 */
import type { Context } from 'hono';
import type { AppEnv } from '#/types/appEnv';

// why: x-batch-id alone is spoofable; txn is set by prepareRequestMiddleware only for registered batches
export const isBatchSubRequest = (c: Context<AppEnv>): boolean => c.get('txn') !== undefined;
