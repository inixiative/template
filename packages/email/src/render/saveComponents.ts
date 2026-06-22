/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent } from '@template/db/generated/client/client';
import type { OwnerScope } from '@template/email/render/types';
import { assertValidConditions } from '@template/email/render/validateConditions';

const depthFirstOrder = (inputs: EmailComponent[]): EmailComponent[] => {
  const bySlug = new Map(inputs.map((c) => [c.slug, c]));
  const visited = new Set<string>();
  const ordered: EmailComponent[] = [];

  const visit = (component: EmailComponent) => {
    if (visited.has(component.slug)) return;
    visited.add(component.slug);
    for (const ref of component.componentRefs ?? []) {
      const child = bySlug.get(ref);
      if (child) visit(child);
    }
    ordered.push(component);
  };

  for (const input of inputs) visit(input);
  return ordered;
};

export const saveComponents = async (inputs: EmailComponent[], ctx: OwnerScope): Promise<EmailComponent[]> => {
  const saved: EmailComponent[] = [];
  for (const input of depthFirstOrder(inputs)) {
    saved.push(await saveComponent(input, ctx));
  }
  return saved;
};

const saveComponent = async (input: EmailComponent, ctx: OwnerScope): Promise<EmailComponent> => {
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
