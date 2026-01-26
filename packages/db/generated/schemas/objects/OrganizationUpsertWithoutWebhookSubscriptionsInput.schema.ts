import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUpdateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUncheckedCreateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema'

const makeSchema = () => z.object({
  update: z.union([z.lazy(() => OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema)]),
  create: z.union([z.lazy(() => OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)]),
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional()
}).strict();
export const OrganizationUpsertWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.OrganizationUpsertWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpsertWithoutWebhookSubscriptionsInput>;
export const OrganizationUpsertWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
