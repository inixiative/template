/**
 * Save template - find + create/update at context level.
 * Uses findFirst to handle nullable FKs in compound unique (Prisma 7 quirk).
 */

import { db } from '@template/db';
import type { EmailTemplate } from '@template/db';
import type { SaveContext } from './types';

export const saveTemplate = async (
  input: EmailTemplate,
  ctx: SaveContext,
): Promise<EmailTemplate> => {
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
