import { auth } from '#/lib/auth';

export const requireOwnerSession = async (c) => {
  const cookie = c.req.header('cookie');
  return auth.api.getSession({ headers: new Headers({ cookie }) });
};
