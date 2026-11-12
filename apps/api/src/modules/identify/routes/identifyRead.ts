/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { TokenScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

const responseSchema = z.discriminatedUnion('model', [
  z.object({ model: z.literal('User'), record: userResponseSchema }),
  z.object({ model: z.literal('Token'), record: TokenScalarSchema.omit({ keyHash: true }) }),
]);

export type IdentifyResponse = z.infer<typeof responseSchema>;

export const identifyReadRoute = readRoute({
  model: Modules.identify,
  skipId: true,
  responseSchema,
  description: 'Who the credential is: the acting user or token, as the permission rules see it.',
  tags: [Tags.identify],
});
