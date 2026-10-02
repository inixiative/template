/**
 * @atlas
 * @kind handler
 * @partOf feature:email
 * @uses infrastructure:prisma, infrastructure:redis, primitive:errors
 */
import { DbAction, db, type HookOptions, HookTiming, registerDbHook } from '@template/db';
import type { EmailOwnerModel, EmailTemplate } from '@template/db/generated/client/client';
import { castArray, groupBy, isPlainObject } from 'lodash-es';
import { makeError } from '#/lib/errors';

type TemplateWrite = Partial<Pick<EmailTemplate, 'id' | 'slug' | 'ownerModel' | 'deletedAt'>>;

const isRecord = (value: unknown): value is Record<string, unknown> => isPlainObject(value);

const merge = (previous: unknown, data: unknown): TemplateWrite => ({
  ...(isRecord(previous) ? previous : {}),
  ...(isRecord(data) ? data : {}),
});

const rowsAfterWrite = ({
  action,
  args,
  previous,
}: HookOptions<EmailTemplate>): TemplateWrite[] => {
  const { data, create, update } = (isRecord(args) ? args : {}) as Record<string, unknown>;
  switch (action) {
    case DbAction.create:
    case DbAction.createManyAndReturn:
      return castArray(data).filter(isRecord) as TemplateWrite[];
    case DbAction.update:
      return [merge(previous, data)];
    case DbAction.updateManyAndReturn:
      return castArray(previous ?? []).map((row) => merge(row, data));
    case DbAction.upsert:
      return [previous ? merge(previous, update) : merge(undefined, create)];
    default:
      return [];
  }
};

const tierOf = (row: TemplateWrite): EmailOwnerModel => row.ownerModel ?? 'default';

const reservedSlugError = (slug: string, claiming: EmailOwnerModel, heldBy: EmailOwnerModel) =>
  makeError({
    status: 409,
    message:
      heldBy === 'admin'
        ? `Template slug "${slug}" belongs to an admin template and cannot be used by a ${claiming} template.`
        : `Template slug "${slug}" is already used by a ${heldBy} template, so it cannot become an admin template.`,
  });

const assertSlugAvailable = async (slug: string, rows: TemplateWrite[]): Promise<void> => {
  const tiers = new Set(rows.map(tierOf));
  const isAdmin = tiers.has('admin');
  if (isAdmin && tiers.size > 1) {
    const other = [...tiers].find((tier) => tier !== 'admin') ?? 'default';
    throw reservedSlugError(slug, other, 'admin');
  }

  await db.findForUpdate('EmailTemplate', { slug }, { upserting: true });
  const ownIds = rows.map((row) => row.id).filter((id): id is string => typeof id === 'string');
  const holder = await db.emailTemplate.findFirst({
    where: {
      slug,
      deletedAt: null,
      ownerModel: isAdmin ? { not: 'admin' } : 'admin',
      ...(ownIds.length && { id: { notIn: ownIds } }),
    },
    select: { ownerModel: true },
  });
  if (holder) throw reservedSlugError(slug, isAdmin ? 'admin' : tierOf(rows[0]), holder.ownerModel);
};

export const registerEmailTemplateSlugReservationHook = () => {
  registerDbHook<EmailTemplate>(
    'emailTemplateSlugReservation',
    'EmailTemplate',
    HookTiming.before,
    [
      DbAction.create,
      DbAction.createManyAndReturn,
      DbAction.update,
      DbAction.updateManyAndReturn,
      DbAction.upsert,
    ],
    async (options) => {
      const live = rowsAfterWrite(options).filter(
        (row): row is TemplateWrite & { slug: string } =>
          typeof row.slug === 'string' && !row.deletedAt,
      );
      const bySlug = groupBy(live, (row) => row.slug);
      for (const slug of Object.keys(bySlug).sort()) await assertSlugAvailable(slug, bySlug[slug]);
    },
  );
};
