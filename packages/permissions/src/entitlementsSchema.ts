/**
 * @atlas
 * @kind schema
 * @partOf primitive:authz
 * @uses none
 */
import type { Entitlements } from '@inixiative/permissions';
import { isInPersonAction } from '@template/permissions/rebac/inPersonActions';
import { actionRuleSchema } from '@template/permissions/rebac/permissionRulesSchema';
import { z } from 'zod';

const grantKey = /^[a-z]+:[A-Za-z]+(:[^:\s]+)?$/;

const action = z
  .string()
  .min(1)
  .refine((name) => !isInPersonAction(name), 'an in-person action is never granted by entitlement');

const ruleValue = z.object({ rule: actionRuleSchema }).strict();

export const entitlementsSchema: z.ZodType<Entitlements> = z
  .record(
    z.string().regex(grantKey, 'a grant key is map:model or map:model:id'),
    z.record(action, z.union([z.literal(true), ruleValue])),
  )
  .nullable() as unknown as z.ZodType<Entitlements>;
