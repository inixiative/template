import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  status: WebhookEventStatusSchema,
  action: WebhookEventActionSchema,
  payload: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  error: z.string().optional().nullable(),
  subscriptionId: z.string().max(36),
  resourceId: z.string().max(36)
}).strict();
export const WebhookEventUncheckedCreateInputObjectSchema: z.ZodType<Prisma.WebhookEventUncheckedCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUncheckedCreateInput>;
export const WebhookEventUncheckedCreateInputObjectZodSchema = makeSchema();
