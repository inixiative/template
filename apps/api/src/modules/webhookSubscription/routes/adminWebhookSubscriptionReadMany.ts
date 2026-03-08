import { z } from '@hono/zod-openapi';
import { WebhookSubscriptionScalarSchema } from '@template/db';
import { WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/enums';
import { readRoute } from '#/lib/routeTemplates';
import { advancedSearchSchema, simpleSearchSchema } from '#/lib/routeTemplates/searchSchema';
import { Modules } from '#/modules/modules';

const querySchema = z.object({
  search: simpleSearchSchema,
  searchFields: advancedSearchSchema,
  ownerModel: z.nativeEnum(WebhookOwnerModel).optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  model: z.nativeEnum(WebhookModel).optional(),
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
