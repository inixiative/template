/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';

const replaceBlock = (mjml: string, slug: string, content: string): string =>
  mjml.replace(new RegExp(`\\{\\{#component:${slug}\\}\\}[\\s\\S]*?\\{\\{\\/component:${slug}\\}\\}`, 'g'), content);

export const recomposeSnapshot = async (auditLogId: string): Promise<string | null> => {
  const snapshot = await db.auditLog.findUnique({ where: { id: auditLogId } });
  const after = snapshot?.after as { mjml?: string } | null;
  if (!after?.mjml) return null;

  let result = after.mjml;
  const versions = (snapshot?.componentVersions ?? {}) as Record<string, string | null>;
  for (const [slug, childId] of Object.entries(versions)) {
    if (!childId) continue;
    const childContent = await recomposeSnapshot(childId);
    if (childContent !== null) result = replaceBlock(result, slug, childContent);
  }

  return result;
};

// @wip — replay a sent communication's exact rendered MJML from its pinned template snapshot.
// Resend / preview consumer is COMM follow-up; recomposeSnapshot is the live path today.
export const recomposeCommunication = async (communicationLogId: string): Promise<string | null> => {
  const log = await db.communicationLog.findUnique({ where: { id: communicationLogId } });
  if (!log?.emailTemplateAuditLogId) return null;
  return recomposeSnapshot(log.emailTemplateAuditLogId);
};
