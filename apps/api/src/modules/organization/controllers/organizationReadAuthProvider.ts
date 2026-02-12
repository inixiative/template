import { getResource } from '#/lib/context/getResource';
import { getPlatformProviders } from '#/lib/auth/platformProviders';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadAuthProviderRoute } from '#/modules/organization/routes/organizationReadAuthProvider';
import { check, rebacSchema } from '@template/permissions/rebac';

export const organizationReadAuthProviderController = makeController(
  organizationReadAuthProviderRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = getResource(c);
    const user = c.get('user');
    const permix = c.get('permix');

    // Check if user has owner permissions - owners see all providers (enabled + disabled)
    const isOwner = user && check(permix, rebacSchema, 'organization', organization, 'own');

    const platformProviders = getPlatformProviders();

    const orgProviders = await db.authProvider.findMany({
      where: {
        organizationId: organization.id,
        ...(isOwner ? {} : { enabled: true }),
      },
      omit: {
        encryptedSecrets: true,
        encryptedSecretsMetadata: true,
        encryptedSecretsKeyVersion: true,
      },
    });

    return respond.ok({
      platform: platformProviders,
      organization: orgProviders,
    });
  },
);
