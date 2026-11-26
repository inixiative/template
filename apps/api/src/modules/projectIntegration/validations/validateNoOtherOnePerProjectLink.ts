/**
 * @atlas
 * @kind validator
 * @partOf feature:project
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { db } from '@template/db';
import type { Integration } from '@template/db/generated/client/client';
import { isIntegrationOnePer } from '@template/shared/integrations/integrationOnePer';
import { makeError } from '#/lib/errors';

export const validateNoOtherOnePerProjectLink = async (
  projectId: string,
  integration: Pick<Integration, 'id' | 'provider'>,
) => {
  if (!isIntegrationOnePer(integration.provider, 'project')) return;
  await db.findForUpdate('ProjectIntegration', { projectId }, { upserting: true });
  const existing = await db.projectIntegration.findFirst({
    where: {
      projectId,
      integrationId: { not: integration.id },
      integration: { provider: integration.provider, deletedAt: null },
    },
    select: { integrationId: true },
  });
  if (existing)
    throw makeError({
      status: 409,
      message: `This project is already linked to a ${integration.provider} integration (${existing.integrationId}); only one is allowed`,
    });
};
