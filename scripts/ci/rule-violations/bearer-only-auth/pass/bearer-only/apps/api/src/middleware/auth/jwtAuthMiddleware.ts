import { verifyIssuerJwt } from '#/lib/auth/verifyIssuerJwt';

export const jwtAuthMiddleware = async (c, next) => {
  const authorization = c.req.header('authorization');
  if (authorization?.startsWith('Bearer ')) c.set('claims', await verifyIssuerJwt(authorization.slice(7)));
  await next();
};
