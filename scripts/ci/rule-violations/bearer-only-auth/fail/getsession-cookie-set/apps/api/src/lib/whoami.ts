import { auth } from '#/lib/auth';

export const whoami = (sessionCookie: string) => {
  const headers = new Headers();
  headers.set('cookie', sessionCookie);
  return auth.api.getSession({ headers });
};
