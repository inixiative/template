/**
 * @atlas
 * @kind validator
 * @partOf feature:project
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import type { Integration } from '@template/db/generated/client/client';
import { makeError } from '#/lib/errors';
import { fetchOtherOnePerProjectLink } from '#/modules/projectIntegration/services/fetchOtherOnePerProjectLink';

export const validateNoOtherOnePerProjectLink = async (
  projectId: string,
  integration: Pick<Integration, 'id' | 'provider'>,
) => {
  const existing = await fetchOtherOnePerProjectLink(projectId, integration);
  if (existing)
    throw makeError({
      status: 409,
      message: `This project is already linked to a ${integration.provider} integration (${existing.integrationId}); only one is allowed`,
    });
};
