import { isUniqueConstraintError } from '@template/db';

export const isDuplicate = (err: unknown) => isUniqueConstraintError(err);
