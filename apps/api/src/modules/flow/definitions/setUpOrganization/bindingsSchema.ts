/**
 * @atlas
 * @kind schema
 * @partOf primitive:flows
 * @uses none
 */
import { uuidV7Schema } from '@template/shared/utils';
import { z } from 'zod';
import { flowUrlSchema } from '#/modules/flow/schemas/flowSchemas';

export const bindingsSchema = z.object({
  organizationId: uuidV7Schema,
  returnUrl: flowUrlSchema.optional(),
});
