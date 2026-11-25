/**
 * @atlas
 * @kind service
 * @partOf feature:setting
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Setting } from '@template/db/generated/client/client';
import type { Provider } from '@template/db/generated/client/enums';

export const settingIntegrationProvider = async (
  setting: Partial<
    Pick<Setting, 'resourceModel' | 'resourceIntegrationId' | 'resourceProjectIntegrationId'>
  >,
): Promise<Provider | undefined> => {
  if (setting.resourceModel === 'Integration' && setting.resourceIntegrationId) {
    const integration = await db.integration.findUniqueOrThrow({
      where: { id: setting.resourceIntegrationId },
      select: { provider: true },
    });
    return integration.provider ?? undefined;
  }
  if (setting.resourceModel !== 'ProjectIntegration' || !setting.resourceProjectIntegrationId)
    return undefined;
  const link = await db.projectIntegration.findUniqueOrThrow({
    where: { id: setting.resourceProjectIntegrationId },
    select: { integration: { select: { provider: true } } },
  });
  return link.integration.provider ?? undefined;
};
