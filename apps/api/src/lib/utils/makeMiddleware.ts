import type { Context, MiddlewareHandler, Next } from 'hono';
import type { AppEnv } from '#/types/appEnv';

type Handler = (c: Context<AppEnv>, next: Next) => Promise<Response | void>;

export const makeMiddleware = <T>(
  factory: (options: T) => Handler,
): ((options: T) => MiddlewareHandler) => factory;
