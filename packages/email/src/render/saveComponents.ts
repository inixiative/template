/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent } from '@template/db/generated/client/client';
import type { SaveContext } from '@template/email/render/types';
import { assertValidConditions } from '@template/email/render/validateConditions';

export const saveComponents = async (inputs: EmailComponent[], ctx: SaveContext): Promise<EmailComponent[]> => {
  return Promise.all(inputs.map((input) => saveComponent(input, ctx)));
};

const saveComponent = async (input: EmailComponent, ctx: SaveContext): Promise<EmailComponent> => {
  // Validate conditionals at the unit boundary — a component can be saved on a path that didn't run
  // the template-level check. MJML is intentionally not validated here: component bodies are
  // fragments (`<mj-section>…`), not full `<mjml>` documents, so the document validator can't see them.
  assertValidConditions(input.mjml);

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
