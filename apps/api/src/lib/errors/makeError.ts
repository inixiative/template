import { type Guidance, HTTP_ERROR_MAP, type HttpErrorCode } from '@template/shared/errors';
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
};

export class AppError extends HTTPException {
  requestId?: string;
  private _body: Record<string, unknown>;

  constructor(status: number, body: Record<string, unknown>) {
    super(status as HttpErrorCode, { message: body.message as string });
    this._body = body;
  }

  getResponse(): Response {
    return new Response(JSON.stringify({ ...this._body, requestId: this.requestId }), {
      status: this.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const makeError = (options: MakeErrorOptions): AppError => {
  const status = options.status ?? 500;
  const meta = HTTP_ERROR_MAP[status];

  return new AppError(status, {
    error: meta.label,
    message: options.message ?? meta.name,
    guidance: options.guidance ?? meta.guidance,
    fieldErrors: options.fieldErrors,
  });
};
