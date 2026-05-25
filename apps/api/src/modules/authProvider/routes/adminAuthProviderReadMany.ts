import { z } from '@hono/zod-openapi';
import { AuthProviderScalarSchema } from '@template/db';
import { lensFor } from '@template/db/lens';
import { readRoute } from '#/lib/routeTemplates';
import { Modules } from '#/modules/modules';

export const adminAuthProviderReadManyRoute = readRoute({
  model: Modules.authProvider,
  many: true,
  paginate: true,
  admin: true,
  query: z.object({
    organizationId: z.string().optional(),
  }),
  filterLens: { parent: lensFor('AuthProvider') },
  responseSchema: AuthProviderScalarSchema.omit({
    encryptedSecrets: true,
    encryptedSecretsMetadata: true,
    encryptedSecretsKeyVersion: true,
  }),
});
