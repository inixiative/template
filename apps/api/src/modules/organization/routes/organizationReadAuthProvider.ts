import { z } from '@hono/zod-openapi';
import { AuthProviderScalarSchema } from '@template/db';
import { readRoute } from '#/lib/routeTemplates';
import { PlatformProviderSchema } from '#/modules/authProvider/schemas/authProviderSchemas';
import { Modules } from '#/modules/modules';

const AuthProvidersResponseSchema = z.object({
  platform: z.array(PlatformProviderSchema),
  organization: z.array(
    AuthProviderScalarSchema.omit({
      encryptedSecrets: true,
      encryptedSecretsMetadata: true,
      encryptedSecretsKeyVersion: true,
    }),
  ),
});

export const organizationReadAuthProviderRoute = readRoute({
  model: Modules.organization,
  submodel: 'authProvider',
  responseSchema: AuthProvidersResponseSchema,
  description: 'Returns platform and organization-specific auth providers',
});
