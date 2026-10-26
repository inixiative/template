/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { Tags } from '#/modules/tags';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';
import { userResponseSchema } from '#/modules/user/schemas/userResponseSchema';

const responseSchema = z.discriminatedUnion('model', [
  z.object({ model: z.literal('User'), record: userResponseSchema }),
  z.object({ model: z.literal('Token'), record: tokenReadResponseSchema }),
]);

export type IdentifyResponse = z.infer<typeof responseSchema>;

export const identifyReadRoute = readRoute({
  model: Modules.identify,
  skipId: true,
  responseSchema,
  description: 'Who the credential is: the acting user or token, as the permission rules see it.',
  tags: [Tags.identify],
});
