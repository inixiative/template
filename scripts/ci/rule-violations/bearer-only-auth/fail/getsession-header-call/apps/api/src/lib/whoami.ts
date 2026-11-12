import { auth } from '#/lib/auth';

export const whoami = (c) => auth.api.getSession({ headers: c.req.header() });
