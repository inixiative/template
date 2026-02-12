import { z } from '@hono/zod-openapi';
import { AuthProviderScalarSchema } from '@template/db';
import { updateRoute } from '#/lib/routeTemplates';
import { validateActor } from '#/middleware/validations/validateActor';
import { validatePermission } from '#/middleware/validations/validatePermission';
import { Modules } from '#/modules/modules';

const AuthProviderUpdateBodySchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  config: z.record(z.any()).optional(),
  secrets: z.record(z.any()).optional(),
});

export const authProviderUpdateRoute = updateRoute({
  model: Modules.authProvider,
  bodySchema: AuthProviderUpdateBodySchema,
  responseSchema: AuthProviderScalarSchema.omit({
    encryptedSecrets: true,
    encryptedSecretsMetadata: true,
    encryptedSecretsKeyVersion: true,
  }),
  sanitizeKeys: ['organizationId', 'createdBy', 'type', 'provider', 'encryptedSecrets', 'encryptedSecretsMetadata', 'encryptedSecretsKeyVersion'],
  middleware: [validateActor, validatePermission('own')],
});
