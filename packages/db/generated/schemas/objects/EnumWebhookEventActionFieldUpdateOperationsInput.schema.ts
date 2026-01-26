import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookEventActionSchema } from '../enums/WebhookEventAction.schema'

const makeSchema = () => z.object({
  set: WebhookEventActionSchema.optional()
}).strict();
export const EnumWebhookEventActionFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumWebhookEventActionFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookEventActionFieldUpdateOperationsInput>;
export const EnumWebhookEventActionFieldUpdateOperationsInputObjectZodSchema = makeSchema();
