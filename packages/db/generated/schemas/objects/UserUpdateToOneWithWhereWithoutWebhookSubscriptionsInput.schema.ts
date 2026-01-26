import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserUpdateWithoutWebhookSubscriptionsInputObjectSchema as UserUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUpdateWithoutWebhookSubscriptionsInput.schema';
import { UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema as UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUncheckedUpdateWithoutWebhookSubscriptionsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => UserUpdateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema)])
}).strict();
export const UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInput>;
export const UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
