/**
 * @atlas
 * @kind handler
 * @partOf feature:users
 * @uses infrastructure:prisma, primitive:errors, primitive:shared
 */
import { registerDbInvariant } from '@template/db';
import { emailAddressSchema } from '@template/shared/contact';
import { castArray, isPlainObject } from 'lodash-es';
import { makeError } from '#/lib/errors';

const isRecord = (value: unknown): value is Record<string, unknown> => isPlainObject(value);

const emailsBeingWritten = (data: unknown): unknown[] =>
  castArray(data)
    .filter(isRecord)
    .filter((row) => 'email' in row)
    .map((row) => (isRecord(row.email) && 'set' in row.email ? row.email.set : row.email));

export const assertUserEmailWritable = (email: unknown): void => {
  if (typeof email === 'string' && emailAddressSchema.safeParse(email).success) return;
  throw makeError({
    status: 422,
    message: 'Validation failed',
    fieldErrors: { email: ['must be a valid email address'] },
  });
};

export const registerUserEmailInvariantHook = () => {
  registerDbInvariant('userEmail', 'User', ({ data }) => {
    for (const email of emailsBeingWritten(data)) assertUserEmailWritable(email);
  });
};
