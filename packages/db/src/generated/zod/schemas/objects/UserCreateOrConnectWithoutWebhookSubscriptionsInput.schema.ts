import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { UserWhereUniqueInputObjectSchema as UserWhereUniqueInputObjectSchema } from './UserWhereUniqueInput.schema';
import { UserCreateWithoutWebhookSubscriptionsInputObjectSchema as UserCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserCreateWithoutWebhookSubscriptionsInput.schema';
import { UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './UserUncheckedCreateWithoutWebhookSubscriptionsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => UserWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => UserCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => UserUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)])
}).strict();
export const UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.UserCreateOrConnectWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.UserCreateOrConnectWithoutWebhookSubscriptionsInput>;
export const UserCreateOrConnectWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
