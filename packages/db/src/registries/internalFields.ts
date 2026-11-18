/**
 * @atlas
 * @kind registry
 * @partOf infrastructure:prisma
 * @uses none
 */
import type { FieldRegistry } from '@template/db/registries/noopFields';

export const INTERNAL_FIELDS: FieldRegistry = {
  User: ['platformRole'],
};
