/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailComponent, EmailTemplate, PrismaClient } from '@template/db/generated/client/client';
import type { OwnerScope } from '@template/email/render/types';

type LookupResult = {
  template: EmailTemplate | null;
  components: Record<string, EmailComponent>;
};

export const lookupAtSpace = async (
  db: PrismaClient,
  templateSlug: string | null,
  componentSlugs: string[],
  ctx: OwnerScope,
): Promise<LookupResult> => {
  // Coalesce a missing tenant id to null (no match at this tier → cascade down), never undefined —
  // in a Prisma `where`, undefined drops the filter, which would match across tenants.
  const base = {
    locale: ctx.locale,
    ownerModel: 'Space' as const,
    spaceId: ctx.spaceId ?? null,
  };

  const [comps, template] = await Promise.all([
    componentSlugs.length
      ? db.emailComponent.findMany({ where: { slug: { in: componentSlugs }, ...base } })
      : Promise.resolve([]),
    templateSlug ? db.emailTemplate.findFirst({ where: { slug: templateSlug, ...base } }) : Promise.resolve(null),
  ]);

  const components: Record<string, EmailComponent> = {};
  for (const c of comps) components[c.slug] = c;

  return { template, components };
};

export const lookupAtOrg = async (
  db: PrismaClient,
  templateSlug: string | null,
  componentSlugs: string[],
  ctx: OwnerScope,
  requireInherit = false,
): Promise<LookupResult> => {
  // See lookupAtSpace: a missing organizationId must be null (no match → cascade), not undefined
  // (which would drop the filter and match other tenants' org templates).
  const base = {
    locale: ctx.locale,
    ownerModel: 'Organization' as const,
    organizationId: ctx.organizationId ?? null,
    spaceId: null,
    ...(requireInherit && { inheritToSpaces: true }),
  };

  const [comps, template] = await Promise.all([
    componentSlugs.length
      ? db.emailComponent.findMany({ where: { slug: { in: componentSlugs }, ...base } })
      : Promise.resolve([]),
    templateSlug ? db.emailTemplate.findFirst({ where: { slug: templateSlug, ...base } }) : Promise.resolve(null),
  ]);

  const components: Record<string, EmailComponent> = {};
  for (const c of comps) components[c.slug] = c;

  return { template, components };
};

export const lookupAtDefault = async (
  db: PrismaClient,
  templateSlug: string | null,
  componentSlugs: string[],
  ctx: OwnerScope,
): Promise<LookupResult> => {
  const base = {
    locale: ctx.locale,
    ownerModel: 'default' as const,
    organizationId: null,
    spaceId: null,
  };

  const [comps, template] = await Promise.all([
    componentSlugs.length
      ? db.emailComponent.findMany({ where: { slug: { in: componentSlugs }, ...base } })
      : Promise.resolve([]),
    templateSlug ? db.emailTemplate.findFirst({ where: { slug: templateSlug, ...base } }) : Promise.resolve(null),
  ]);

  const components: Record<string, EmailComponent> = {};
  for (const c of comps) components[c.slug] = c;

  return { template, components };
};

export const lookupAtAdmin = async (
  db: PrismaClient,
  templateSlug: string | null,
  componentSlugs: string[],
  ctx: OwnerScope,
): Promise<LookupResult> => {
  const base = {
    locale: ctx.locale,
    ownerModel: 'admin' as const,
    organizationId: null,
    spaceId: null,
  };

  const [comps, template] = await Promise.all([
    componentSlugs.length
      ? db.emailComponent.findMany({ where: { slug: { in: componentSlugs }, ...base } })
      : Promise.resolve([]),
    templateSlug ? db.emailTemplate.findFirst({ where: { slug: templateSlug, ...base } }) : Promise.resolve(null),
  ]);

  const components: Record<string, EmailComponent> = {};
  for (const c of comps) components[c.slug] = c;

  return { template, components };
};
