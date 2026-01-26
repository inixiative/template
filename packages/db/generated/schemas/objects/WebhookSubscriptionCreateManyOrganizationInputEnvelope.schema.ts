import * as z from 'zod';
import type { Prisma } from '../../../src/generated/client/client';
import { WebhookSubscriptionCreateManyOrganizationInputObjectSchema as WebhookSubscriptionCreateManyOrganizationInputObjectSchema } from './WebhookSubscriptionCreateManyOrganizationInput.schema'

const makeSchema = () => z.object({
  data: z.union([z.lazy(() => WebhookSubscriptionCreateManyOrganizationInputObjectSchema), z.lazy(() => WebhookSubscriptionCreateManyOrganizationInputObjectSchema).array()]),
  skipDuplicates: z.boolean().optional()
}).strict();
export const WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectSchema: z.ZodType<Prisma.WebhookSubscriptionCreateManyOrganizationInputEnvelope> = makeSchema() as unknown as z.ZodType<Prisma.WebhookSubscriptionCreateManyOrganizationInputEnvelope>;
export const WebhookSubscriptionCreateManyOrganizationInputEnvelopeObjectZodSchema = makeSchema();
