/**
 * @atlas
 * @kind handler
 * @partOf primitive:jobs
 * @uses feature:email, infrastructure:prisma
 */
import { db } from '@template/db';
import { recomputeDegradedComponentRefs } from '@template/email/render';
import { makeSupersedingJob } from '#/jobs/makeSupersedingJob';
import type { WorkerContext } from '#/jobs/types';

export type RecomputeEmailDependentsPayload = { slug: string };

type Dependent = { model: 'EmailComponent' | 'EmailTemplate'; id: string; slug: string };

const directDependentsOf = async (slug: string): Promise<Dependent[]> => {
  const where = { componentRefs: { has: slug }, deletedAt: null };
  const select = { id: true, slug: true };
  const [components, templates] = await Promise.all([
    db.emailComponent.findMany({ where, select }),
    db.emailTemplate.findMany({ where, select }),
  ]);
  return [
    ...components.map((row) => ({ model: 'EmailComponent' as const, ...row })),
    ...templates.map((row) => ({ model: 'EmailTemplate' as const, ...row })),
  ];
};

const restampDependentsOf = async (
  ctx: WorkerContext,
  slug: string,
  visited: Set<string>,
): Promise<void> => {
  for (const dependent of await directDependentsOf(slug)) {
    const key = `${dependent.model}:${dependent.id}`;
    if (visited.has(key)) continue;
    visited.add(key);

    ctx.signal?.throwIfAborted();
    await recomputeDegradedComponentRefs(dependent.model, dependent.id);
    if (dependent.model === 'EmailComponent')
      await restampDependentsOf(ctx, dependent.slug, visited);
  }
};

// Restamps degradedComponentRefs on every live row that renders the component slug, directly or
// through other components, after a write to that slug has committed. The versioning hook enqueues
// it with a 5 second delay, and the job supersedes by slug: a newer enqueue for the same slug
// displaces a queued run and aborts a running one, so a burst of saves to one component collapses
// into a single restamp of its dependents. Aborting mid-walk is safe because the newer run walks the
// same dependents from the start, and every recompute reads the current live rows rather than
// anything carried in the payload. The signal is checked between rows so a superseded run stops at
// the next row instead of finishing the walk.
export const recomputeEmailDependents = makeSupersedingJob<RecomputeEmailDependentsPayload>(
  (ctx, { slug }) => restampDependentsOf(ctx, slug, new Set()),
  ({ slug }) => slug,
);
