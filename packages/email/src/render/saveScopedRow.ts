/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import type { OwnerScope } from '@template/email/render/types';

type ScopedEmailRow = {
  emailComponent: EmailComponent;
  emailTemplate: EmailTemplate;
};

type ScopedDelegate<Row extends { id: string }> = {
  findFirst: (args: { where: Partial<Row> }) => Promise<Row | null>;
  update: (args: { where: { id: string }; data: Partial<Row> }) => Promise<Row>;
  create: (args: { data: Partial<Row> }) => Promise<Row>;
};

// Resolve the row by its natural key within the owner scope, then update-or-create. Two-stage
// (findFirst → update/create) rather than a Prisma `upsert`: the natural-key uniques are PARTIAL
// (`WHERE deleted_at IS NULL`), which `upsert`/`ON CONFLICT` can't target — so the read-then-write is
// the deliberate soft-delete adaptation, shared by both scoped email rows so the flow lives in one place.
export const saveScopedRow = async <Model extends keyof ScopedEmailRow>(
  model: Model,
  input: ScopedEmailRow[Model] & { slug: string; locale: string },
  ctx: OwnerScope,
): Promise<ScopedEmailRow[Model]> => {
  type Row = ScopedEmailRow[Model];
  const delegate = (model === 'emailTemplate' ? db.emailTemplate : db.emailComponent) as unknown as ScopedDelegate<Row>;

  const scope = {
    ownerModel: ctx.ownerModel,
    organizationId: ctx.organizationId ?? null,
    spaceId: ctx.spaceId ?? null,
  } as Partial<Row>;

  const where = { slug: input.slug, locale: input.locale, ...scope } as Partial<Row>;
  const data = { ...input, ...scope } as Partial<Row>;

  const existing = await delegate.findFirst({ where });
  if (existing) return delegate.update({ where: { id: existing.id }, data });
  return delegate.create({ data });
};
