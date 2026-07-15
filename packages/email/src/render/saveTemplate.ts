/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailTemplate } from '@template/db/generated/client/client';
import type { OwnerScope } from '@template/email/render/types';

export const saveTemplate = async (input: EmailTemplate, ctx: OwnerScope): Promise<EmailTemplate> => {
  const where = {
    slug: input.slug,
    locale: input.locale,
    ownerModel: ctx.ownerModel,
    organizationId: ctx.organizationId ?? null,
    spaceId: ctx.spaceId ?? null,
  };

  const data = {
    ...input,
    ownerModel: ctx.ownerModel,
    organizationId: ctx.organizationId ?? null,
    spaceId: ctx.spaceId ?? null,
  };

  const existing = await db.emailTemplate.findFirst({ where });

  if (existing) {
    return db.emailTemplate.update({ where: { id: existing.id }, data });
  }
  return db.emailTemplate.create({ data });
};
