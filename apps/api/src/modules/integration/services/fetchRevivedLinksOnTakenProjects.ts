/**
 * @atlas
 * @kind query
 * @partOf feature:integrations
 * @uses infrastructure:prisma, infrastructure:redis
 */
import { db } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import { isIntegrationOnePer } from '@template/shared/integrations/integrationOnePer';
import { fetchOtherOnePerProjectLink } from '#/modules/projectIntegration/services/fetchOtherOnePerProjectLink';

export const fetchRevivedLinksOnTakenProjects = async (
  integration: Pick<Integration, 'id' | 'provider' | 'deletedAt'>,
): Promise<string[]> => {
  if (!isIntegrationOnePer(integration.provider, 'project')) return [];
  const revivedLinks = await db.withDeleted(() =>
    db.projectIntegration.findMany({
      where: { integrationId: integration.id, deletedAt: integration.deletedAt },
      select: { id: true, projectId: true },
    }),
  );
  const taken: string[] = [];
  for (const link of revivedLinks)
    if (await fetchOtherOnePerProjectLink(link.projectId, integration)) taken.push(link.id);
  return taken;
};
