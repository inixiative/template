import { encryptField } from '@template/db/lib/encryption/helpers';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { authProviderUpdateRoute } from '#/modules/authProvider/routes/authProviderUpdate';

export const authProviderUpdateController = makeController(
  authProviderUpdateRoute,
  async (c, respond) => {
    const db = c.get('db');
    const authProvider = getResource<'authProvider'>(c);
    const { secrets, ...body } = c.req.valid('json');

    let encryptedData = {};

    if (secrets) {
      encryptedData = await encryptField('authProvider', 'secrets', {
        ...authProvider,
        ...body,
        secrets,
      });
    }

    const updated = await db.authProvider.update({
      where: { id: authProvider.id },
      data: {
        ...body,
        ...encryptedData,
      },
    });

    const { encryptedSecrets, encryptedSecretsMetadata, encryptedSecretsKeyVersion, ...safeProvider } = updated;

    return respond.ok(safeProvider);
  },
);
