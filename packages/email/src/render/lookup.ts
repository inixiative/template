/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import type { EmailComponent, EmailOwnerModel, Prisma } from '@template/db/generated/client/client';
import { ownerWhere } from '@template/email/render/owner';
import type { OwnerScope } from '@template/email/render/types';

const latestSnapshotInclude = {
  auditLogs: { take: 1, orderBy: { id: 'desc' }, select: { id: true } },
} satisfies Prisma.EmailTemplateInclude;

export type TemplateWithSnapshot = Prisma.EmailTemplateGetPayload<{ include: typeof latestSnapshotInclude }>;

type LookupResult = {
  template: TemplateWithSnapshot | null;
  components: Record<string, EmailComponent>;
};

export const lookupAtOwner = async (
  templateSlug: string | null,
  componentSlugs: string[],
  ctx: OwnerScope,
  tier: EmailOwnerModel = ctx.ownerModel,
): Promise<LookupResult> => {
  const where = ownerWhere(ctx, tier);

  const [comps, template] = await Promise.all([
    componentSlugs.length
      ? db.emailComponent.findMany({ where: { slug: { in: componentSlugs }, ...where } })
      : Promise.resolve([]),
    templateSlug
      ? db.emailTemplate.findFirst({ where: { slug: templateSlug, ...where }, include: latestSnapshotInclude })
      : Promise.resolve(null),
  ]);

  const components: Record<string, EmailComponent> = Object.create(null);
  for (const c of comps) components[c.slug] = c;

  return { template, components };
};
