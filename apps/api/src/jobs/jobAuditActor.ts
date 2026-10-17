/**
 * @atlas
 * @kind utils
 * @partOf primitive:jobs
 * @uses infrastructure:prisma
 */
import { type AuditActor, nullAuditActor } from '@template/db/lib/auditActorContext';

export const jobAuditActor = (jobName: string, payload: unknown): AuditActor => ({
  ...nullAuditActor,
  actorJobName: jobName,
  integrationId:
    typeof payload === 'object' &&
    payload !== null &&
    'integrationId' in payload &&
    typeof payload.integrationId === 'string'
      ? payload.integrationId
      : null,
});
