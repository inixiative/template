/**
 * @atlas
 * @kind query
 * @partOf infrastructure:prisma
 * @uses infrastructure:prisma
 */
import { db } from '@template/db/client';
import type { Setting } from '@template/db/generated/client/client';
import { type SettingResourceKinds, settingResourceKindsOf } from '@template/shared/settings';

export type SettingResourceKeys = Partial<
  Pick<Setting, 'resourceModel' | 'resourceIntegrationId' | 'resourceProjectIntegrationId'>
>;

export const fetchSettingResourceKinds = async (
  resource: SettingResourceKeys,
): Promise<SettingResourceKinds> => {
  if (resource.resourceModel === 'Integration' && resource.resourceIntegrationId) {
    const integration = await db.integration.findUniqueOrThrow({
      where: { id: resource.resourceIntegrationId },
      select: { provider: true },
    });
    return settingResourceKindsOf('Integration', integration.provider);
  }
  if (resource.resourceModel === 'ProjectIntegration' && resource.resourceProjectIntegrationId) {
    const link = await db.projectIntegration.findUniqueOrThrow({
      where: { id: resource.resourceProjectIntegrationId },
      select: { integration: { select: { provider: true } } },
    });
    return settingResourceKindsOf('ProjectIntegration', link.integration.provider);
  }
  return {};
};
