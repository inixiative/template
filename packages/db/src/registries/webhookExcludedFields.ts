/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import { INTERNAL_FIELDS } from '@template/db/registries/internalFields';
import {
  type FieldRegistry,
  NOOP_FIELDS,
  unionRegistries,
} from '@template/db/registries/noopFields';
import { SENSITIVE_FIELDS } from '@template/db/registries/sensitiveFields';

// A sensitive-only or internal-only change noops the delivery, and neither kind of value reaches a receiver.
export const WEBHOOK_EXCLUDED_FIELDS: FieldRegistry = unionRegistries(
  NOOP_FIELDS,
  SENSITIVE_FIELDS,
  INTERNAL_FIELDS,
);
