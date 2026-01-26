import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookModelSchema } from '../enums/WebhookModel.schema'

const makeSchema = () => z.object({
  set: WebhookModelSchema.optional()
}).strict();
export const EnumWebhookModelFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumWebhookModelFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookModelFieldUpdateOperationsInput>;
export const EnumWebhookModelFieldUpdateOperationsInputObjectZodSchema = makeSchema();
