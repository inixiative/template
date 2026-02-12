import { z } from '@hono/zod-openapi';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { PlatformProviderSchema } from '#/modules/authProvider/schemas/authProviderSchemas';

export const authProviderReadManyRoute = readRoute({
  model: Modules.authProvider,
  many: true,
  responseSchema: PlatformProviderSchema,
  description: 'Returns platform auth providers. Public endpoint for login/signup pages.',
});
