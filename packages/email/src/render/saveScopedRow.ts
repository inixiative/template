/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db, revive } from '@template/db';
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import type { OwnerScope } from '@template/email/render/types';

type ScopedEmailRow = {
  emailComponent: EmailComponent;
  emailTemplate: EmailTemplate;
};

type ScopedDelegate<Row extends { id: string }> = {
  findFirst: (args: { where: Partial<Row> | Record<string, unknown> }) => Promise<Row | null>;
  update: (args: { where: { id: string }; data: Partial<Row> }) => Promise<Row>;
  create: (args: { data: Partial<Row> }) => Promise<Row>;
};

const reviveRow = (model: keyof ScopedEmailRow, id: string) =>
  model === 'emailTemplate' ? revive(db.emailTemplate, { id }) : revive(db.emailComponent, { id });

// A natural key (slug, locale, owner) holds at most one row, live or tombstoned: the uniques cover
// deleted rows too. Saving onto the key updates the live row, or revives the tombstone in place so
// the id, its audit history and every reference to it carry over; only a key that has never existed
// gets a new row. This stays read-then-write rather than an upsert because the uniques are still
// partial on ownerModel (each tier keys on its own nullable FK column), and a partial index cannot be
// the target of `ON CONFLICT`. Two concurrent creates of a never-existing key both miss the reads; the
// unique rejects the second one, which surfaces as a unique violation. That is the correct outcome.
export const saveScopedRow = async <Model extends keyof ScopedEmailRow>(
  model: Model,
  input: ScopedEmailRow[Model] & { slug: string; locale: string },
  ctx: OwnerScope,
): Promise<ScopedEmailRow[Model]> => {
  type Row = ScopedEmailRow[Model];
  const delegate = db[model] as unknown as ScopedDelegate<Row>;

  const scope = {
    ownerModel: ctx.ownerModel,
    organizationId: ctx.organizationId ?? null,
    spaceId: ctx.spaceId ?? null,
    userId: ctx.userId ?? null,
  } as Partial<Row>;

  const naturalKey = { slug: input.slug, locale: input.locale, ...scope };
  const data = { ...input, ...scope } as Partial<Row>;
  const { id: _inputId, ...keptData } = data as Partial<Row> & { id?: string };

  const live = await delegate.findFirst({ where: { ...naturalKey, deletedAt: null } });
  if (live) return delegate.update({ where: { id: live.id }, data: keptData as Partial<Row> });

  const tombstone = await db.withDeleted(() =>
    delegate.findFirst({ where: { ...naturalKey, deletedAt: { not: null } } }),
  );
  if (!tombstone) return delegate.create({ data });

  await reviveRow(model, tombstone.id);
  return delegate.update({ where: { id: tombstone.id }, data: keptData as Partial<Row> });
};
