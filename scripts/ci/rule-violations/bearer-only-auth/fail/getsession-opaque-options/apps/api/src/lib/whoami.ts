import { auth } from '#/lib/auth';

export const whoami = (options: { headers: Headers }) => auth.api.getSession(options);
