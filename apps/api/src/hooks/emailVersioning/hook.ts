/**
 * @atlas
 * @kind hook
 * @partOf feature:email
 * @uses infrastructure:prisma, feature:email
 */
import { DbAction, db, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import type { AuditSubjectModel } from '@template/db/generated/client/enums';
import { castArray } from 'lodash-es';
import { resolveChildAuditLogIds } from '#/hooks/emailVersioning/resolveChildAuditLogIds';
import { createVersionBumpSnapshot } from '#/hooks/emailVersioning/snapshot';

type EmailModel = Extract<AuditSubjectModel, 'EmailTemplate' | 'EmailComponent'>;

type VersionedRecord = {
  id: string;
  slug: string;
  componentRefs: string[];
  ownerModel: 'default' | 'admin' | 'Organization' | 'Space';
  organizationId: string | null;
  spaceId: string | null;
  locale: string;
};

const isEmailModel = (model: string): model is EmailModel => model === 'EmailTemplate' || model === 'EmailComponent';

const subjectWhere = (model: EmailModel, id: string) =>
  model === 'EmailTemplate' ? { subjectEmailTemplateId: id } : { subjectEmailComponentId: id };

const findLatestSnapshot = (model: EmailModel, id: string) =>
  db.auditLog.findFirst({
    where: subjectWhere(model, id),
    orderBy: { createdAt: 'desc' },
    select: { id: true, emailComponentAuditLogIds: true },
  });

const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((value, i) => value === b[i]);

const extractRecords = (options: HookOptions): VersionedRecord[] => {
  const result = (options as HookOptions<VersionedRecord>).result;
  if (!result) return [];
  return castArray(result);
};

const stampOwnChildIds = async (model: EmailModel, record: VersionedRecord): Promise<void> => {
  const latest = await findLatestSnapshot(model, record.id);
  if (!latest) return;
  const childIds = await resolveChildAuditLogIds(record);
  if (sameIds(latest.emailComponentAuditLogIds, childIds)) return;
  await db.auditLog.update({ where: { id: latest.id }, data: { emailComponentAuditLogIds: childIds } });
};

const walkUp = async (slug: string, visited: Set<string>): Promise<void> => {
  const [componentAncestors, templateAncestors] = await Promise.all([
    db.emailComponent.findMany({ where: { componentRefs: { has: slug }, deletedAt: null } }),
    db.emailTemplate.findMany({ where: { componentRefs: { has: slug }, deletedAt: null } }),
  ]);

  const ancestors: { model: EmailModel; record: VersionedRecord }[] = [
    ...componentAncestors.map((record) => ({ model: 'EmailComponent' as const, record: record as VersionedRecord })),
    ...templateAncestors.map((record) => ({ model: 'EmailTemplate' as const, record: record as VersionedRecord })),
  ];

  for (const { model, record } of ancestors) {
    const key = `${model}:${record.id}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const newChildIds = await resolveChildAuditLogIds(record);
    const latest = await findLatestSnapshot(model, record.id);
    if (sameIds(latest?.emailComponentAuditLogIds ?? [], newChildIds)) continue;

    await createVersionBumpSnapshot(model, record, newChildIds);
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
    DbAction.delete,
    DbAction.deleteMany,
  ];

  registerDbHook('emailVersioning', '*', HookTiming.after, actions, async (options: HookOptions) => {
    if (!isEmailModel(options.model)) return;

    const isDelete = options.action === DbAction.delete || options.action === DbAction.deleteMany;
    const visited = new Set<string>();

    for (const record of extractRecords(options)) {
      if (!isDelete) await stampOwnChildIds(options.model, record);
      await walkUp(record.slug, visited);
    }
  });
};
