/**
 * Save components - find + create/update at context level.
 * Uses findFirst to handle nullable FKs in compound unique (Prisma 7 quirk).
 */

import type { EmailComponent } from '@template/db';
import { db } from '@template/db';
import type { SaveContext } from './types';

export const saveComponents = async (inputs: EmailComponent[], ctx: SaveContext): Promise<EmailComponent[]> => {
  return Promise.all(inputs.map((input) => saveComponent(input, ctx)));
};

const saveComponent = async (input: EmailComponent, ctx: SaveContext): Promise<EmailComponent> => {
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

  const existing = await db.emailComponent.findFirst({ where });

  if (existing) {
    return db.emailComponent.update({ where: { id: existing.id }, data });
  }
  return db.emailComponent.create({ data });
};
