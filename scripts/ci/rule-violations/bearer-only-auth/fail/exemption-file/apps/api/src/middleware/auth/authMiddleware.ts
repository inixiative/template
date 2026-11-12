import { auth } from '#/lib/auth';

export const authMiddleware = async (c, next) => {
  const headers = new Headers(c.req.raw.headers);
  headers.delete('cookie');
  const session = await auth.api.getSession({ headers });
  if (!session) return next();
  await next();
};
