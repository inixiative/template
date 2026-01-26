import * as z from 'zod';
import type { Prisma } from '../../../client/client';
import { OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUncheckedCreateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema as OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationCreateOrConnectWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUpsertWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUpsertWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUpsertWithoutWebhookSubscriptionsInput.schema';
import { OrganizationWhereInputObjectSchema as OrganizationWhereInputObjectSchema } from './OrganizationWhereInput.schema';
import { OrganizationWhereUniqueInputObjectSchema as OrganizationWhereUniqueInputObjectSchema } from './OrganizationWhereUniqueInput.schema';
import { OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUpdateWithoutWebhookSubscriptionsInput.schema';
import { OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema as OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema } from './OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInput.schema'

const makeSchema = () => z.object({
  create: z.union([z.lazy(() => OrganizationCreateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUncheckedCreateWithoutWebhookSubscriptionsInputObjectSchema)]).optional(),
  connectOrCreate: z.lazy(() => OrganizationCreateOrConnectWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  upsert: z.lazy(() => OrganizationUpsertWithoutWebhookSubscriptionsInputObjectSchema).optional(),
  disconnect: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  delete: z.union([z.boolean(), z.lazy(() => OrganizationWhereInputObjectSchema)]).optional(),
  connect: z.lazy(() => OrganizationWhereUniqueInputObjectSchema).optional(),
  update: z.union([z.lazy(() => OrganizationUpdateToOneWithWhereWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUpdateWithoutWebhookSubscriptionsInputObjectSchema), z.lazy(() => OrganizationUncheckedUpdateWithoutWebhookSubscriptionsInputObjectSchema)]).optional()
}).strict();
export const OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInputObjectSchema: z.ZodType<Prisma.OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInput> = makeSchema() as unknown as z.ZodType<Prisma.OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInput>;
export const OrganizationUpdateOneWithoutWebhookSubscriptionsNestedInputObjectZodSchema = makeSchema();
