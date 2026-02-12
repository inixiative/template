import { HTTP_ERROR_MAP, type Guidance, type HttpErrorCode } from '@template/shared/errors';
import { HTTPException } from 'hono/http-exception';

type MakeErrorOptions = {
  /** HTTP status code (defaults to 500) */
  status?: HttpErrorCode;
  /** User-safe error message (defaults to HTTP status name) */
  message?: string;
  /** Override default guidance for this error */
  guidance?: Guidance;
  /** Field-level validation errors */
  fieldErrors?: Record<string, string[]>;
  /** Request ID from context */
  requestId: string;
};

/**
 * Create a throwable HTTP exception with standardized error body
 *
 * @example
 * ```typescript
 * throw makeError({
 *   status: 422,
 *   message: 'Invalid email format',
 *   fieldErrors: { email: ['Must be a valid email'] },
 *   requestId: c.get('requestId')
 * });
 * ```
 */
export const makeError = (options: MakeErrorOptions): HTTPException => {
  const status = options.status ?? 500;
  const meta = HTTP_ERROR_MAP[status];

  const body = {
    error: meta.label,
    message: options.message ?? meta.name,
    guidance: options.guidance ?? meta.guidance,
    fieldErrors: options.fieldErrors,
    requestId: options.requestId,
  };

  return new HTTPException(status, {
    message: body.message,
    res: new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  });
};
