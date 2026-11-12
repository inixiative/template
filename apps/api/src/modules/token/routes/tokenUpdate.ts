/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { z } from '@hono/zod-openapi';
import { Role } from '@template/db/generated/client/enums';
import { updateRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { tokenReadResponseSchema } from '#/modules/token/schemas/tokenSchemas';

export const tokenUpdateRoute = updateRoute({
  model: Modules.token,
  bodySchema: z
    .object({
      name: z.string().min(1).max(100),
      role: z.nativeEnum(Role).nullable(),
      full: z.boolean(),
    })
    .partial(),
  responseSchema: tokenReadResponseSchema,
});
