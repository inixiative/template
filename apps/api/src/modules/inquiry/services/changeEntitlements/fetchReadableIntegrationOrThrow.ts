/**
 * @atlas
 * @kind query
 * @partOf feature:inquiry
 * @uses primitive:authz, infrastructure:prisma
 */
import { db } from '@template/db';
import type { Permix } from '@template/permissions/client';
import { makeError } from '#/lib/errors';
import { holdsOnRecord } from '#/lib/permissions/holdsOnRecord';

/** The integration a request names, when the caller may read it; one they may not read is as absent as one that does not exist. */
export const fetchReadableIntegrationOrThrow = async (permix: Permix, integrationId: string) => {
  const integration = await db.integration.findUnique({ where: { id: integrationId } });
  if (!integration || !(await holdsOnRecord(permix, 'integration', integration, 'read')))
    throw makeError({ status: 422, message: `No integration ${integrationId} you can read` });
  return integration;
};
