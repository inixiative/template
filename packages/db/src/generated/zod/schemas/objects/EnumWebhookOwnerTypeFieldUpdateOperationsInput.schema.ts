import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { WebhookOwnerTypeSchema } from '../enums/WebhookOwnerType.schema'

const makeSchema = () => z.object({
  set: WebhookOwnerTypeSchema.optional()
}).strict();
export const EnumWebhookOwnerTypeFieldUpdateOperationsInputObjectSchema: z.ZodType<Prisma.EnumWebhookOwnerTypeFieldUpdateOperationsInput> = makeSchema() as unknown as z.ZodType<Prisma.EnumWebhookOwnerTypeFieldUpdateOperationsInput>;
export const EnumWebhookOwnerTypeFieldUpdateOperationsInputObjectZodSchema = makeSchema();
