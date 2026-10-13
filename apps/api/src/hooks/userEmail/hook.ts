/**
 * @atlas
 * @kind handler
 * @partOf feature:users
 * @uses infrastructure:prisma, primitive:errors, primitive:shared
 */
import { DbAction, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import { emailAddressSchema } from '@template/shared/contact';
import { isPlainObject } from 'lodash-es';
import { writtenPatches } from '#/hooks/shared/hookRows';
import { makeError } from '#/lib/errors';

const isRecord = (value: unknown): value is Record<string, unknown> => isPlainObject(value);

const WRITE_ACTIONS = [
  DbAction.create,
  DbAction.createManyAndReturn,
  DbAction.update,
  DbAction.updateManyAndReturn,
  DbAction.upsert,
];

// Only a write that names `email` is judged, so an unrelated update to a user with a legacy
// malformed address still goes through.
const emailsBeingWritten = (options: HookOptions): unknown[] =>
  writtenPatches(options)
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
  registerDbHook('userEmail', 'User', HookTiming.before, WRITE_ACTIONS, async (options) => {
    for (const email of emailsBeingWritten(options)) assertUserEmailWritable(email);
  });
};
