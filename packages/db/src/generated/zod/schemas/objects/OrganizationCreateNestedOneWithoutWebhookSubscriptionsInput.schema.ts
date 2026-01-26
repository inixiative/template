import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUncheckedCreateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateOrConnectWithoutWebhookSubscriptionsInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional()
}).strict();
export const OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutWebhookSubscriptionsInput>;
export const OrganizationCreateNestedOneWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
