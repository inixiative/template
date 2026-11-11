/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { db, revive } from '@template/db';
import { encryptField } from '@template/db/lib/encryption/helpers';
import { getResource } from '#/lib/context/getResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateAuthProviderRoute } from '#/modules/organization/routes/organizationCreateAuthProvider';

export const organizationCreateAuthProviderController = makeController(
  organizationCreateAuthProviderRoute,
  async (c, respond) => {
    const org = getResource<'organization'>(c);
    const { secrets, ...body } = c.req.valid('json');

    const provider = await db.txn(async () => {
      const [revived] = await revive(db.authProvider, {
        organizationId: org.id,
        provider: body.provider,
        type: body.type,
      });

      const data = {
        enabled: true,
        ...body,
        id: revived?.id ?? Bun.randomUUIDv7(),
        organizationId: org.id,
      };

      const encryptedData = await encryptField('authProvider', 'secrets', { ...data, secrets });

      if (revived)
        return db.authProvider.update({
          where: { id: revived.id },
          data: { enabled: data.enabled, ...body, ...encryptedData },
        });
      return db.authProvider.create({ data: { ...data, ...encryptedData } });
    });

    const {
      encryptedSecrets,
      encryptedSecretsMetadata,
      encryptedSecretsKeyVersion,
      ...safeProvider
    } = provider;

    return respond.created(safeProvider);
  },
);
