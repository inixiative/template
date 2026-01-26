import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserCreateWithoutWebhookSubscriptionsInputObjectSchema as UserCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateWithoutWebhookSubscriptionsInput.schema';
import { UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUncheckedCreateWithoutWebhookSubscriptionsInput.schema';
import { UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema as UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateOrConnectWithoutWebhookSubscriptionsInput.schema';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => UserCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  connect: z.lazy(() => UserWhereUniqueInputObjectSchema).optional()
}).strict();
export const UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.UserCreateNestedOneWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateNestedOneWithoutWebhookSubscriptionsInput>;
export const UserCreateNestedOneWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
