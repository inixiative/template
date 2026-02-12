import { z } from '@hono/zod-openapi';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';
import { AuthProviderScalarSchema } from '@template/db';
import { PlatformProviderSchema } from '#/modules/authProvider/schemas/authProviderSchemas';

const AuthProvidersResponseSchema = z.object({
  platform: z.array(PlatformProviderSchema),
  organization: z.array(AuthProviderScalarSchema.omit({
    encryptedSecrets: true,
    encryptedSecretsMetadata: true,
    encryptedSecretsKeyVersion: true,
  })),
});

export const organizationReadAuthProviderRoute = readRoute({
  model: Modules.organization,
  submodel: 'authProvider',
  responseSchema: AuthProvidersResponseSchema,
  description: 'Returns platform and organization-specific auth providers',
});
