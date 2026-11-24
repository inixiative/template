/**
 * @atlas
 * @kind controller
 * @partOf feature:tenancy
 * @uses primitive:authz, primitive:routeTemplates, feature:auth
 */
import { check, schemaMap } from '@template/permissions/rebac';
import { configuredPlatformProviders } from '#/lib/auth/platformProviders';
import { contextResource } from '#/lib/context/contextResource';
import { makeController } from '#/lib/utils/makeController';
import { organizationReadAuthProviderRoute } from '#/modules/organization/routes/organizationReadAuthProvider';

export const organizationReadAuthProviderController = makeController(
  organizationReadAuthProviderRoute,
  async (c, respond) => {
    const db = c.get('db');
    const organization = contextResource(c);
    const permix = c.get('permix');

    // Check if user has owner permissions - owners see all providers (enabled + disabled)
    const isOwner = check(permix, schemaMap, 'organization', organization, 'own');

    const platformProviders = configuredPlatformProviders();

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
