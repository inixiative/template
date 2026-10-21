/**
 * @atlas
 * @kind schema
 * @partOf feature:webhooks
 * @uses none
 */
import { z } from '@hono/zod-openapi';
import { WebhookModel, WebhookOwnerModel } from '@template/db/generated/client/enums';
import { infoResponseSchema } from '#/lib/jsonSchema/infoResponseSchema';

export const webhookSubscriptionInfoResponseSchema = infoResponseSchema(
  z.object({
    models: z
      .record(z.nativeEnum(WebhookOwnerModel), z.nativeEnum(WebhookModel).array())
      .describe('Per owner model, the models a subscription it owns may name.'),
    signature: z
      .object({
        publicKey: z.string().describe('Public key that verifies `x-webhook-signature`.'),
        algorithm: z.string().describe('Signature algorithm.'),
        encoding: z.string().describe('Encoding of the signature header.'),
      })
      .describe('How deliveries are signed.'),
  }),
);
