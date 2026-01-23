import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().optional(),
  createdAt: z.coerce.date().optional(),
  status: WebhookEventStatusSchema,
  action: WebhookEventActionSchema,
  payload: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  error: z.string().optional().nullable(),
  resourceId: z.string()
}).strict();
export const WebhookEventUncheckedCreateWithoutSubscriptionInputObjectSchema: z.ZodType<Prisma.WebhookEventUncheckedCreateWithoutSubscriptionInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventUncheckedCreateWithoutSubscriptionInput>;
export const WebhookEventUncheckedCreateWithoutSubscriptionInputObjectZodSchema = makeSchema();
