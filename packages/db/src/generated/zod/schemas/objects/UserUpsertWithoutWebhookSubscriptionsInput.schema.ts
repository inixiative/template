import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserUpdateWithoutWebhookSubscriptionsInputObjectSchema as UserUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUpdateWithoutWebhookSubscriptionsInput.schema';
import { UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema as UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUncheckedUpdateWithoutWebhookSubscriptionsInput.schema';
import { UserCreateWithoutWebhookSubscriptionsInputObjectSchema as UserCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateWithoutWebhookSubscriptionsInput.schema';
import { UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUncheckedCreateWithoutWebhookSubscriptionsInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => UserUpdateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema)]),
  create: z.union([z.lazy(() => UserCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)]),
  where: z.lazy(() => UserWhereInputObjectSchema).optional()
}).strict();
export const UserUpsertWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.UserUpsertWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpsertWithoutWebhookSubscriptionsInput>;
export const UserUpsertWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
