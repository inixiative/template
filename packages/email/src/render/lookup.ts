/**
 * Lookup template + components at scope.
 */

import type { EmailComponent, EmailTemplate, PrismaClient } from '@template/db/generated/client/client';
import type { SaveContext } from '@template/email/render/types';

type LookupResult = {
  template: EmailTemplate | null;
  components: Record<string, EmailComponent>;
};

export const lookupAtSpace = async (
  db: PrismaClient,
  templateSlug: string | null,
  componentSlugs: string[],
  ctx: SaveContext,
): Promise<LookupResult> => {
  const base = {
    locale: ctx.locale,
    ownerModel: 'Space' as const,
    organizationId: ctx.organizationId,
    spaceId: ctx.spaceId,
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
  ctx: SaveContext,
  requireInherit = false,
): Promise<LookupResult> => {
  const base = {
    locale: ctx.locale,
    ownerModel: 'Organization' as const,
    organizationId: ctx.organizationId,
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
  ctx: SaveContext,
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
  ctx: SaveContext,
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
