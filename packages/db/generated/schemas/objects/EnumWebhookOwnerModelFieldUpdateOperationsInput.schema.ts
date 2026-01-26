import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookOwnerModelSchema } from '../enums/WebhookOwnerModel.schema'

const makeSchema = () => z.object({
  set: WebhookOwnerModelSchema.optional()
}).strict();
export const EnumWebhookOwnerModelFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumWebhookOwnerModelFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookOwnerModelFieldUpdateOperationsInput>;
export const EnumWebhookOwnerModelFieldUpdateOperationsInputObjectZodSchema = makeSchema();
