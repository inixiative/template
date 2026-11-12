import { HTTPException } from 'hono/http-exception';

export class AppError extends HTTPException {}

export const makeError = (status: 400 | 404) => new AppError(status);
export const wrap = (status: 400 | 404) => new HTTPException(status);
