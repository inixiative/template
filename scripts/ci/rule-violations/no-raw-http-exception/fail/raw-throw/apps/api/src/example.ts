import { HTTPException } from 'hono/http-exception';

export const requireOwner = (ownerId: string | undefined) => {
  if (!ownerId) throw new HTTPException(409, { message: 'Library owner mismatch' });
};
