import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUpdateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInput.schema'

const makeSchema = () => z.object({
  where: z.lazy(() => OrganizationWhereInputObjectSchema).optional(),
  data: z.union([z.lazy(() => OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema)])
}).strict();
export const OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInput>;
export const OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectZodSchema = makeSchema();
