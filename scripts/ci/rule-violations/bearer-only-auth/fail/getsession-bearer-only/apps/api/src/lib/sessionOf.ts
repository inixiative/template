import { auth } from '#/lib/auth';

export const sessionOf = (token: string) =>
  auth.api.getSession({ headers: new Headers({ authorization: `Bearer ${token}` }) });
