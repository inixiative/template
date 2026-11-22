/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:routeTemplates, infrastructure:prisma
 */
import { db } from '@template/db';
import type { AuthProvider } from '@template/db/generated/client/client';
import { encryptField } from '@template/db/lib/encryption/fieldEncryption';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationCreateAuthProviderRoute } from '#/modules/organization/routes/organizationCreateAuthProvider';

export const organizationCreateAuthProviderController = makeController(
  organizationCreateAuthProviderRoute,
  async (c, respond) => {
    const org = contextResource<'organization'>(c);
    const { secrets, ...body } = c.req.valid('json');

    const provider = await db.txn(async () => {
      const key = { organizationId: org.id, provider: body.provider, type: body.type };
      const [existing] = await db.withDeleted(() =>
        db.findForUpdate<AuthProvider>('AuthProvider', key),
      );
      const data = {
        enabled: true,
        ...body,
        id: existing?.id ?? Bun.randomUUIDv7(),
        organizationId: org.id,
      };
      const encryptedData = await encryptField('authProvider', 'secrets', { ...data, secrets });

      return db.withDeleted(() =>
        db.authProvider.upsert({
          where: { organizationId_provider_type: key },
          create: { ...data, ...encryptedData },
          update: { enabled: data.enabled, ...body, ...encryptedData, deletedAt: null },
        }),
      );
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
