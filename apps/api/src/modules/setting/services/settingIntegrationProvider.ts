/**
 * @atlas
 * @kind service
 * @partOf feature:setting
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { Provider, SettingResourceModel } from '@template/db/generated/client/enums';

export const settingIntegrationProvider = async (
  resourceModel: SettingResourceModel,
  resource: Record<string, unknown>,
): Promise<Provider | undefined> => {
  if (resourceModel === 'Integration') return (resource.provider as Provider | null) ?? undefined;
  if (resourceModel !== 'ProjectIntegration') return undefined;
  const integration = await db.integration.findUniqueOrThrow({
    where: { id: resource.integrationId as string },
    select: { provider: true },
  });
  return integration.provider ?? undefined;
};
