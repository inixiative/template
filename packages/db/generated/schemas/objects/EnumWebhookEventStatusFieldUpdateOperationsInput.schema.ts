import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventStatusSchema } from '../enums/WebhookEventStatus.schema'

const makeSchema = () => z.object({
  set: WebhookEventStatusSchema.optional()
}).strict();
export const EnumWebhookEventStatusFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumWebhookEventStatusFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookEventStatusFieldUpdateOperationsInput>;
export const EnumWebhookEventStatusFieldUpdateOperationsInputObjectZodSchema = makeSchema();
