/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { renderBlocks } from '@template/email/render';

export type ComponentSnapshot = { mjml: string; componentVersions: Record<string, string | null> };
export type LoadSnapshot = (auditLogId: string) => Promise<ComponentSnapshot | null>;

export const recomposeFromSnapshots = async (auditLogId: string, load: LoadSnapshot): Promise<string | null> => {
  const root = await load(auditLogId);
  if (!root) return null;

  const bodies: Record<string, string> = {};
  const seen = new Set([auditLogId]);
  let frontier = Object.entries(root.componentVersions);
  while (frontier.length) {
    const next: [string, string | null][] = [];
    for (const [slug, childId] of frontier) {
      if (!childId || seen.has(childId) || bodies[slug] !== undefined) continue;
      seen.add(childId);
      const child = await load(childId);
      if (!child) continue;
      bodies[slug] = child.mjml;
      next.push(...Object.entries(child.componentVersions));
    }
    frontier = next;
  }

  return renderBlocks(root.mjml, async (slug) => bodies[slug] ?? '');
};

const loadAuditSnapshot: LoadSnapshot = async (auditLogId) => {
  const snapshot = await db.auditLog.findUnique({ where: { id: auditLogId } });
  const mjml = (snapshot?.after as { mjml?: string } | null)?.mjml;
  if (!mjml) return null;
  return { mjml, componentVersions: (snapshot?.componentVersions ?? {}) as Record<string, string | null> };
};

export const recomposeSnapshot = (auditLogId: string): Promise<string | null> =>
  recomposeFromSnapshots(auditLogId, loadAuditSnapshot);

// The recorded settledMjml is the sent truth (send-time sender-scoped cascade, interpolated);
// the pinned snapshot is a save-time reconstruction resolved through the template row's own owner
// scope, so it is the fallback for rows sent before capture existed, never the preferred source.
export const recomposeCommunication = async (communicationLogId: string): Promise<string | null> => {
  const log = await db.communicationLog.findUnique({ where: { id: communicationLogId } });
  if (!log) return null;
  if (log.settledMjml !== null) return log.settledMjml;
  if (!log.emailTemplateAuditLogId) return null;
  return recomposeSnapshot(log.emailTemplateAuditLogId);
};
