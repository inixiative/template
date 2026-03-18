import { db, organizationId } from '@template/db';
import { encryptField } from '@template/db/lib/encryption/helpers';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateAuthProviderRoute } from '#/modules/organization/routes/organizationCreateAuthProvider';

export const organizationCreateAuthProviderController = makeController(
  organizationCreateAuthProviderRoute,
  async (c, respond) => {
    const org = getResource<'organization'>(c);
    const { secrets, ...body } = c.req.valid('json');

    const data = {
      ...body,
      id: crypto.randomUUID(),
      organizationId: organizationId(org.id),
    };

    const encryptedData = await encryptField('authProvider', 'secrets', { ...data, secrets });

    const provider = await db.authProvider.create({
      data: {
        ...data,
        ...encryptedData,
      },
    });

    const { encryptedSecrets, encryptedSecretsMetadata, encryptedSecretsKeyVersion, ...safeProvider } = provider;

    return respond.created(safeProvider);
  },
);
