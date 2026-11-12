import { auth } from '#/lib/auth';

export const whoami = (c) => {
  const requestHeaders = c.req.raw.headers;
  return auth.api.getSession({ headers: requestHeaders });
};
