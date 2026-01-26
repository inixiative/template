import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUncheckedCreateWithoutWebhookSubscriptionsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereUniqueInputObjectSchema),
  create: z.union([z.lazy(() => OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)])
}).strict();
export const OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutWebhookSubscriptionsInput>;
export const OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
