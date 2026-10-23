import { auth } from '#/lib/auth';

export const identify = (req: Request) => auth.api.getSession({ headers: req.headers });
