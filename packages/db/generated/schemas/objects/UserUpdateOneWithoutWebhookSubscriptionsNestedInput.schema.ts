import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { UserCreateWithoutWebhookSubscriptionsInputObjectSchema as UserCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateWithoutWebhookSubscriptionsInput.schema';
import { UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUncheckedCreateWithoutWebhookSubscriptionsInput.schema';
import { UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema as UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateOrConnectWithoutWebhookSubscriptionsInput.schema';
import { UserUpsertWithoutWebhookSubscriptionsInputObjectSchema as UserUpsertWithoutWebhookSubscriptionsInputObjectSchema } from './UserUpsertWithoutWebhookSubscriptionsInput.schema';
import { UserWhereInputObjectSchema as UserWhereInputObjectSchema } from './UserWhereInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema as UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema } from './UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInput.schema';
import { UserUpdateWithoutWebhookSubscriptionsInputObjectSchema as UserUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUpdateWithoutWebhookSubscriptionsInput.schema';
import { UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema as UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUncheckedUpdateWithoutWebhookSubscriptionsInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  upsert: z.lazy(() => UserUpsertWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => UserWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => UserUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUpdateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema)]).optional()
}).strict();
export const UserUpdateOneWithoutWebhookSubscriptionsNestedInputObjectSchema: z.ZodType<Prisma.UserUpdateOneWithoutWebhookSubscriptionsNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.UserUpdateOneWithoutWebhookSubscriptionsNestedInput>;
export const UserUpdateOneWithoutWebhookSubscriptionsNestedInputObjectZodSchema = makeSchema();
