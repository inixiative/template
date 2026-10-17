import { makeError } from '#/lib/errors';

export const requireOwner = (ownerId: string | undefined) => {
  if (!ownerId) throw makeError({ status: 409, message: 'Library owner mismatch' });
};
