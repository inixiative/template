/**
 * @atlas
 * @kind middleware, error
 * @partOf primitive:errors
 * @uses primitive:shared
 */
import { HTTP_ERROR_MAP, isHttpErrorCode } from '@template/shared/errors';
import type { HTTPException } from 'hono/http-exception';
import { AppError } from '#/lib/errors';

const isBodyHeader = (name: string) =>
  name.startsWith('content-') || ['etag', 'last-modified', 'transfer-encoding'].includes(name);

export const toAppError = (err: HTTPException): AppError => {
  if (err instanceof AppError) return err;
  const fallbackStatus = err.status >= 500 ? 500 : 400;
  const meta = HTTP_ERROR_MAP[isHttpErrorCode(err.status) ? err.status : fallbackStatus];
  const headers = Object.fromEntries(
    [...(err.res?.headers ?? new Headers())].filter(([name]) => !isBodyHeader(name)),
  );
  return new AppError(
    err.status,
    { error: meta.label, message: err.message || meta.name, guidance: meta.guidance },
    headers,
  );
};
