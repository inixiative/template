import { paginate } from '#/lib/prisma/paginate';
import { makeController } from '#/lib/utils/makeController';
import { adminAuthProviderReadManyRoute } from '#/modules/authProvider/routes/adminAuthProviderReadMany';

export const adminAuthProviderReadManyController = makeController(
  adminAuthProviderReadManyRoute,
  async (c, respond) => {
    const db = c.get('db');
    const { organizationId } = c.req.valid('query');

    const { data, pagination } = await paginate(c, db.authProvider, {
      where: organizationId ? { organizationId } : {},
      omit: {
        encryptedSecrets: true,
        encryptedSecretsMetadata: true,
        encryptedSecretsKeyVersion: true,
      },
    });

    return respond.ok(data, { pagination });
  },
);
