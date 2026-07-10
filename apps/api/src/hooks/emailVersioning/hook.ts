/**
 * @atlas
 * @kind hook
 * @partOf feature:email
 * @uses infrastructure:prisma, feature:email
 */
import { DbAction, db, type HookOptions, HookTiming, type Prisma, registerDbHook } from '@template/db';
import type { AuditSubjectModel } from '@template/db/generated/client/enums';
import { toArray } from '@template/shared/utils';
import { isEqual } from 'lodash-es';
import { processAuditData } from '#/hooks/auditLog/utils';
import { resolveComponentVersions, type VersionedRecord } from '#/hooks/emailVersioning/resolveComponentVersions';
import { createVersionBumpSnapshot } from '#/hooks/emailVersioning/snapshot';

type EmailModel = Extract<AuditSubjectModel, 'EmailTemplate' | 'EmailComponent'>;

// '*' (not per-model) is load-bearing: must run AFTER the global audit hook whose snapshot it
// augments, and executeHooks runs model hooks before global hooks. (The audit hook is '*' too.)
const isEmailModel = (model: string): model is EmailModel => model === 'EmailTemplate' || model === 'EmailComponent';

const findLatestSnapshot = (model: EmailModel, id: string) =>
  db.auditLog.findFirst({
    where: model === 'EmailTemplate' ? { subjectEmailTemplateId: id } : { subjectEmailComponentId: id },
    orderBy: { id: 'desc' },
  });

type Change = { record: VersionedRecord; previous?: VersionedRecord };

const extractChanges = (options: HookOptions): Change[] => {
  const result = (options as HookOptions<VersionedRecord>).result;
  if (!result) return [];
  const records = toArray(result);
  const previous = (options as HookOptions<VersionedRecord>).previous;
  if (Array.isArray(previous)) {
    const byId = new Map(previous.map((p) => [p.id, p]));
    return records.map((record) => ({ record, previous: byId.get(record.id) }));
  }
  return records.map((record) => ({ record, previous: previous ?? undefined }));
};

const wroteSnapshot = (model: EmailModel, change: Change): boolean =>
  !change.previous ||
  !isEqual(
    processAuditData(model, change.previous as Record<string, unknown>),
    processAuditData(model, change.record as Record<string, unknown>),
  );

const isSoftDelete = (change: Change): boolean => change.previous?.deletedAt == null && change.record.deletedAt != null;

const degradedFrom = (versions: Record<string, string | null>): string[] =>
  Object.entries(versions)
    .filter(([, id]) => id === null)
    .map(([slug]) => slug)
    .sort();

const syncDegradedRefs = async (
  model: EmailModel,
  record: VersionedRecord,
  versions: Record<string, string | null>,
): Promise<void> => {
  const degraded = degradedFrom(versions);
  if (isEqual([...record.degradedComponentRefs].sort(), degraded)) return;
  if (model === 'EmailTemplate') {
    await db.emailTemplate.update({ where: { id: record.id }, data: { degradedComponentRefs: degraded } });
  } else {
    await db.emailComponent.update({ where: { id: record.id }, data: { degradedComponentRefs: degraded } });
  }
};

const snapshotChildVersions = async (model: EmailModel, record: VersionedRecord): Promise<void> => {
  const latest = await findLatestSnapshot(model, record.id);
  if (!latest) return;
  const versions = await resolveComponentVersions(record);
  if (isEqual(latest.componentVersions, versions)) return;
  await db.auditLog.update({
    where: { id: latest.id },
    data: { componentVersions: versions as Prisma.InputJsonValue },
  });
  await syncDegradedRefs(model, record, versions);
};

const walkUp = async (slug: string, visited: Set<string>): Promise<void> => {
  const [componentAncestors, templateAncestors] = await Promise.all([
    db.emailComponent.findMany({ where: { componentRefs: { has: slug }, deletedAt: null } }),
    db.emailTemplate.findMany({ where: { componentRefs: { has: slug }, deletedAt: null } }),
  ]);

  const ancestors: { model: EmailModel; record: VersionedRecord }[] = [
    ...componentAncestors.map((record) => ({ model: 'EmailComponent' as const, record })),
    ...templateAncestors.map((record) => ({ model: 'EmailTemplate' as const, record })),
  ];

  for (const { model, record } of ancestors) {
    const key = `${model}:${record.id}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const newVersions = await resolveComponentVersions(record);
    const latest = await findLatestSnapshot(model, record.id);
    if (isEqual(latest?.componentVersions ?? {}, newVersions)) continue;

    await createVersionBumpSnapshot(model, record, newVersions);
    await syncDegradedRefs(model, record, newVersions);
    if (model === 'EmailComponent') await walkUp(record.slug, visited);
  }
};

export const registerEmailVersioningHook = (): void => {
  const actions = [
    DbAction.create,
    DbAction.update,
    DbAction.upsert,
    DbAction.createManyAndReturn,
    DbAction.updateManyAndReturn,
  ];

  registerDbHook('emailVersioning', '*', HookTiming.after, actions, async (options: HookOptions) => {
    if (!isEmailModel(options.model)) return;
    const model = options.model;
    const visited = new Set<string>();

    for (const change of extractChanges(options)) {
      if (isSoftDelete(change)) {
        await walkUp(change.record.slug, visited);
        continue;
      }
      if (!wroteSnapshot(model, change)) continue;
      await snapshotChildVersions(model, change.record);
      await walkUp(change.record.slug, visited);
    }
  });
};
