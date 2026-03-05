import { z } from '@hono/zod-openapi';
import { WebhookSubscriptionScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { advancedSearchSchema, simpleSearchSchema } from '#/lib/routeTemplates/searchSchema';
import { Modules } from '#/modules/modules';

const querySchema = z.object({
  search: simpleSearchSchema,
  searchFields: advancedSearchSchema,
  ownerModel: z.enum(['User', 'Organization']).optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  model: z.enum(['User', 'Organization']).optional(),
  isActive: z.coerce.boolean().optional(),
});

export const adminWebhookSubscriptionReadManyRoute = readRoute({
  model: Modules.webhookSubscription,
  many: true,
  paginate: true,
  skipId: true,
  admin: true,
  query: querySchema,
  responseSchema: WebhookSubscriptionScalarSchema,
});
