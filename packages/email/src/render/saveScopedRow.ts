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
  findFirst: (args: {
    where: Partial<Row> | Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }) => Promise<Row | null>;
  update: (args: { where: { id: string }; data: Partial<Row> }) => Promise<Row>;
  create: (args: { data: Partial<Row> }) => Promise<Row>;
};

const reviveRow = (model: keyof ScopedEmailRow, id: string) =>
  model === 'emailTemplate' ? revive(db.emailTemplate, { id }) : revive(db.emailComponent, { id });

// The natural-key uniques are partial (`WHERE deleted_at IS NULL`), so `upsert` can't target them.
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

  const live = await delegate.findFirst({ where: { ...naturalKey, deletedAt: null } });
  if (live) return delegate.update({ where: { id: live.id }, data });

  const tombstone = await db.withDeleted(() =>
    delegate.findFirst({
      where: { ...naturalKey, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    }),
  );
  if (!tombstone) return delegate.create({ data });

  await reviveRow(model, tombstone.id);
  const { id: _inputId, ...revivedData } = data as Partial<Row> & { id?: string };
  return delegate.update({ where: { id: tombstone.id }, data: revivedData as Partial<Row> });
};
