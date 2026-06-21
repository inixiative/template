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
  const snapshot = await db.auditLog.findUnique({
    where: { id: auditLogId },
    select: { after: true, emailComponentAuditLogIds: true },
  });

  const after = snapshot?.after as { mjml?: string } | null;
  if (!after?.mjml) return null;

  let result = after.mjml;
  if (!snapshot!.emailComponentAuditLogIds.length) return result;

  const children = await db.auditLog.findMany({
    where: { id: { in: snapshot!.emailComponentAuditLogIds } },
    select: { id: true, after: true },
  });

  for (const child of children) {
    const childAfter = child.after as { slug?: string } | null;
    if (!childAfter?.slug) continue;
    const childContent = await recomposeSnapshot(child.id);
    if (childContent !== null) result = replaceBlock(result, childAfter.slug, childContent);
  }

  return result;
};

export const recomposeCommunication = async (communicationLogId: string): Promise<string | null> => {
  const log = await db.communicationLog.findUnique({
    where: { id: communicationLogId },
    select: { emailTemplateAuditLogId: true },
  });
  if (!log?.emailTemplateAuditLogId) return null;
  return recomposeSnapshot(log.emailTemplateAuditLogId);
};
