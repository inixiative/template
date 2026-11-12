import { auth } from '#/lib/auth';

export const authMiddleware = async (c, next) => {
  const headers = new Headers(c.req.raw.headers);
  const session = await auth.api.getSession({ headers });
  headers.delete('cookie');
  if (!session) return next();
  await next();
};
