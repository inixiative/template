/**
 * @atlas
 * @kind handler
 * @partOf primitive:errors
 * @uses none
 */
import type { Hook } from '@hono/zod-openapi';
import type { AppEnv } from '#/types/appEnv';

export const validationDefaultHook: Hook<unknown, AppEnv, string, unknown> = (result) => {
  if (!result.success) throw result.error;
};
