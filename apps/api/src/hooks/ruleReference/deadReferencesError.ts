/**
 * @atlas
 * @kind error
 * @partOf infrastructure:prisma
 * @uses primitive:errors
 */
import type { DeadRuleReference } from '@template/db';
import { makeError } from '#/lib/errors';

export const deadReferencesError = (dead: DeadRuleReference[]) =>
  makeError({
    status: 422,
    message: 'The rule references rows that are deleted or missing',
    details: dead,
  });
