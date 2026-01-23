import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema';
import { NullableJsonNullValueInputSchema } from '../enums/NullableJsonNullValueInput.schema';
import { WebhookSubscriptionCreateNestedOneWithoutEventsInputObjectSchema as WebhookSubscriptionCreateNestedOneWithoutEventsInputObjectSchema } from './WebhookSubscriptionCreateNestedOneWithoutEventsInput.schema'

import { JsonValueSchema as jsonSchema } from '../../helpers/json-helpers';

const makeSchema = () => z.object({
  id: z.string().max(36).optional(),
  createdAt: z.coerce.date().optional(),
  status: WebhookEventStatusSchema,
  action: WebhookEventActionSchema,
  payload: z.union([NullableJsonNullValueInputSchema, jsonSchema]).optional(),
  error: z.string().optional().nullable(),
  resourceId: z.string().max(36),
  subscription: z.lazy(() => WebhookSubscriptionCreateNestedOneWithoutEventsInputObjectSchema)
}).strict();
export const WebhookEventCreateInputObjectSchema: z.ZodType<Prisma.WebhookEventCreateInput> = makeSchema() as unknown as z.ZodType<Prisma.WebhookEventCreateInput>;
export const WebhookEventCreateInputObjectZodSchema = makeSchema();
