/**
 * @atlas
 * @kind helper
 * @partOf primitive:authz
 * @uses none
 */
import { inPerson } from '@template/permissions/actor';
import { rebacSchema } from '@template/permissions/rebac/schema';
import type { ActionRule } from '@template/permissions/rebac/types';

const requiresPerson = (rule: ActionRule | undefined): boolean => {
  if (rule === inPerson) return true;
  if (typeof rule !== 'object' || rule === null) return false;
  if ('all' in rule) return rule.all.some(requiresPerson);
  return false;
};

export const isInPersonAction = (action: string): boolean =>
  requiresPerson(rebacSchema.permissions['db:user']?.actions[action]);
