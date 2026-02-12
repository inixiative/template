import { z } from '@hono/zod-openapi';
import { AuthProviderScalarSchema, AuthProviderTypeSchema } from '@template/db';
import { createRoute } from '#/lib/routeTemplates';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

const AuthProviderCreateBodySchema = z.object({
  type: AuthProviderTypeSchema,
  provider: z.string(),
  name: z.string(),
  config: z.record(z.any()),
  secrets: z.record(z.any()),
});

export const organizationCreateAuthProviderRoute = createRoute({
  model: Modules.organization,
  submodel: Modules.authProvider,
  bodySchema: AuthProviderCreateBodySchema,
  responseSchema: AuthProviderScalarSchema.omit({
    encryptedSecrets: true,
    encryptedSecretsMetadata: true,
    encryptedSecretsKeyVersion: true,
  }),
  sanitizeKeys: ['organizationId', 'createdBy', 'encryptedSecrets', 'encryptedSecretsMetadata', 'encryptedSecretsKeyVersion'],
  middleware: [validatePermission('own')],
});
