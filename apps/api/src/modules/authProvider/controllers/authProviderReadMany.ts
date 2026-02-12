import { makeController } from '#/lib/utils/makeController';
import { authProviderReadManyRoute } from '#/modules/authProvider/routes/authProviderReadMany';
import { getPlatformProviders } from '#/lib/auth/platformProviders';

export const authProviderReadManyController = makeController(
  authProviderReadManyRoute,
  async (_c, respond) => {
    const platformProviders = getPlatformProviders();
    return respond.ok(platformProviders);
  },
);
