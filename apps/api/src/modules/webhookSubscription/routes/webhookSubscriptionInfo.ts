import { z } from '@hono/zod-openapi';
import { WebhookModel, WebhookOwnerModel } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

const responseSchema = z.object({
  models: z.record(z.nativeEnum(WebhookOwnerModel), z.nativeEnum(WebhookModel).array()),
  signature: z.object({
    publicKey: z.string(),
    algorithm: z.string(),
    encoding: z.string(),
  }),
});

export const webhookSubscriptionInfoRoute = readRoute({
  model: Modules.webhookSubscription,
  action: 'info',
  skipId: true,
  responseSchema,
  description: 'Returns webhook public key and available models. Public endpoint.',
});
