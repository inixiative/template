/**
 * @atlas
 * @kind query
 * @partOf feature:project
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import { isIntegrationOnePer } from '@template/shared/integrations/integrationOnePer';

export const fetchOtherOnePerProjectLink = async (
  projectId: string,
  integration: Pick<Integration, 'id' | 'provider'>,
) => {
  if (!isIntegrationOnePer(integration.provider, 'project')) return null;
  await db.findForUpdate('ProjectIntegration', { projectId }, { upserting: true });
  return db.projectIntegration.findFirst({
    where: {
      projectId,
      integrationId: { not: integration.id },
      integration: { provider: integration.provider, deletedAt: null },
    },
    select: { integrationId: true },
  });
};
