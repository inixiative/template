/**
 * @atlas
 * @kind route
 * @partOf feature:auth
 * @uses primitive:routeTemplates
 */
import { readRoute } from '#/lib/routeTemplates';
import { PlatformProviderSchema } from '#/modules/authProvider/schemas/authProviderSchemas';
import { Modules } from '#/modules/modules';

export const authProviderReadManyRoute = readRoute({
  model: Modules.authProvider,
  many: true,
  responseSchema: PlatformProviderSchema,
  description: 'Returns platform auth providers. Public endpoint for login/signup pages.',
});
