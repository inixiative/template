/**
 * @atlas
 * @kind hook
 * @partOf feature:email
 * @uses infrastructure:prisma, feature:email
 */

// This hook sits on the edge between audit and cache, and treats the two differently.
//
// Synchronous, inside the writing transaction: the written row's own snapshot (the audit hook
// writes it; this hook stamps its componentVersions), the written row's own degradedComponentRefs,
// and a version-bump snapshot for every ancestor whose resolved component versions moved. A
// snapshot is an audit event. It is per mutation, it is an insert, it takes no lock on the
// ancestor, and it has to ride the transaction that caused it: if it were deferred to a debounced
// job, three quick edits to a component would collapse into one history entry, and the history
// would no longer commit or roll back together with the change it records.
//
// Deferred, after commit: the ancestors' degradedComponentRefs. That column is a cache of state
// that can always be derived again from the live rows. It is per state rather than per event, and
// it is an update on the ancestor row, so writing it here would make every component edit lock
// every template that embeds it. Instead the hook enqueues one recomputeEmailDependents job per
// written component slug once the transaction commits, and a burst of edits to the same component
// shares one run. A stale badge is never a wrong email, because sends render from the live
// components and never read it.
//
// degradedComponentRefs is a NOOP field for both models (packages/db registries/ignoreFields), so
// the job's restamp neither writes an audit entry nor re-enters this hook.

import {
  DbAction,
  db,
  type HookOptions,
  HookTiming,
  type Prisma,
  registerDbHook,
} from '@template/db';
import type { AuditSubjectModel } from '@template/db/generated/client/enums';
import { auditActorStore } from '@template/db/lib/auditActorContext';
import { recomputeDegradedComponentRefs } from '@template/email/render';
import { log } from '@template/shared/logger';
import { ConcurrencyType } from '@template/shared/utils';
import { castArray, isEqual } from 'lodash-es';
import { processAuditData } from '#/hooks/auditLog/utils';
import {
  resolveComponentVersions,
  type VersionedRecord,
} from '#/hooks/emailVersioning/resolveComponentVersions';
import { createVersionBumpSnapshot } from '#/hooks/emailVersioning/snapshot';
import { enqueueJob } from '#/jobs/enqueue';

// Long enough that an editor saving a component several times in a row triggers one restamp of its
// dependents, short enough that the admin list's badge catches up while the editor is still there.
const RESTAMP_DELAY_MS = 5000;

type EmailModel = Extract<AuditSubjectModel, 'EmailTemplate' | 'EmailComponent'>;

// '*' (not per-model) is load-bearing: must run AFTER the global audit hook whose snapshot it
// augments, and executeHooks runs model hooks before global hooks. (The audit hook is '*' too.)
const isEmailModel = (model: string): model is EmailModel =>
  model === 'EmailTemplate' || model === 'EmailComponent';

const findLatestSnapshot = (model: EmailModel, id: string) =>
  db.auditLog.findFirst({
    where:
      model === 'EmailTemplate' ? { subjectEmailTemplateId: id } : { subjectEmailComponentId: id },
    orderBy: { id: 'desc' },
  });

type Change = { record: VersionedRecord; previous?: VersionedRecord };

const extractChanges = (options: HookOptions): Change[] => {
  const result = (options as HookOptions<VersionedRecord>).result;
  if (!result) return [];
  const records = castArray(result);
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

const isSoftDelete = (change: Change): boolean =>
  change.previous?.deletedAt == null && change.record.deletedAt != null;

const snapshotChildVersions = async (model: EmailModel, record: VersionedRecord): Promise<void> => {
  const latest = await findLatestSnapshot(model, record.id);
  if (!latest) return;
  const versions = await resolveComponentVersions(record);
  if (isEqual(latest.componentVersions, versions)) return;
  await db.auditLog.update({
    where: { id: latest.id },
    data: { componentVersions: versions as Prisma.InputJsonValue },
  });
  await recomputeDegradedComponentRefs(model, record.id);
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
    if (model === 'EmailComponent') await walkUp(record.slug, visited);
  }
};

// Only components have dependents: componentRefs names component slugs, so a template write has no
// ancestor badge to restamp. The write has already committed when these run, so an enqueue failure
// is logged and swallowed; the badge stays stale until the next write to that slug.
const restampDependents = (slugs: Set<string>) =>
  [...slugs].map((slug) => async () => {
    try {
      await enqueueJob('recomputeEmailDependents', { slug }, { delay: RESTAMP_DELAY_MS });
    } catch (err) {
      log.error(`Failed to enqueue recomputeEmailDependents for component slug "${slug}"`, err);
    }
  });

export const registerEmailVersioningHook = (): void => {
  const actions = [
    DbAction.create,
    DbAction.update,
    DbAction.upsert,
    DbAction.createManyAndReturn,
    DbAction.updateManyAndReturn,
  ];

  registerDbHook(
    'emailVersioning',
    '*',
    HookTiming.after,
    actions,
    async (options: HookOptions) => {
      if (!isEmailModel(options.model)) return;
      const model = options.model;
      const visited = new Set<string>();
      const writtenComponentSlugs = new Set<string>();

      for (const change of extractChanges(options)) {
        if (isSoftDelete(change)) {
          await walkUp(change.record.slug, visited);
        } else {
          if (!wroteSnapshot(model, change)) continue;
          await snapshotChildVersions(model, change.record);
          await walkUp(change.record.slug, visited);
        }
        if (model === 'EmailComponent') writtenComponentSlugs.add(change.record.slug);
      }

      if (writtenComponentSlugs.size)
        db.onCommit(restampDependents(writtenComponentSlugs), ConcurrencyType.queue);
    },
    [auditActorStore],
  );
};
