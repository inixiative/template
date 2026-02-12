import type { Context } from 'hono';
import { makeError } from '#/lib/errors';
import type { PublicZodIssue } from '#/middleware/error/types';
import type { AppEnv } from '#/types/appEnv';

export const respond422 = (c: Context<AppEnv>, issues: PublicZodIssue[]) => {
  const requestId = c.get('requestId') as string;

  // Convert Zod issues to fieldErrors format
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const path = issue.path;
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }

  return makeError({
    status: 422,
    message: 'Validation failed',
    fieldErrors,
    requestId,
  }).getResponse();
};
