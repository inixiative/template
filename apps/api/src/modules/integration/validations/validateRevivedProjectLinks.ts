/**
 * @atlas
 * @kind validator
 * @partOf feature:integrations
 * @uses infrastructure:prisma, primitive:errors
 */
import { db } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import { isIntegrationOnePer } from '@template/shared/integrations/integrationOnePer';
import { validateNoOtherOnePerProjectLink } from '#/modules/projectIntegration/validations/validateNoOtherOnePerProjectLink';

export const validateRevivedProjectLinks = async (
  integration: Pick<Integration, 'id' | 'provider' | 'deletedAt'>,
) => {
  if (!isIntegrationOnePer(integration.provider, 'project')) return;
  const revivedLinks = await db.withDeleted(() =>
    db.projectIntegration.findMany({
      where: { integrationId: integration.id, deletedAt: integration.deletedAt },
      select: { projectId: true },
    }),
  );
  for (const { projectId } of revivedLinks)
    await validateNoOtherOnePerProjectLink(projectId, integration);
};
