/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import { lookupAtOwner, type TemplateWithSnapshot } from '@template/email/render/lookup';
import { cascadeLookups, firstResolved } from '@template/email/render/owner';
import type { OwnerScope } from '@template/email/render/types';

export const lookupTemplate = (slug: string, ctx: OwnerScope): Promise<TemplateWithSnapshot | null> =>
  firstResolved(cascadeLookups(ctx, (tier) => lookupAtOwner(slug, [], ctx, tier).then((r) => r.template)));

export const lookupComponent = (slug: string, ctx: OwnerScope): Promise<EmailComponent | null> =>
  firstResolved(
    cascadeLookups(ctx, (tier) =>
      lookupAtOwner(null, [slug], ctx, tier).then((r) =>
        Object.hasOwn(r.components, slug) ? r.components[slug] : null,
      ),
    ),
  );

export const templateLens = async (
  slug: string,
  row: Pick<EmailTemplate, 'lens' | 'ownerModel' | 'locale'>,
): Promise<unknown> => {
  if (row.lens != null || row.ownerModel === 'default') return row.lens ?? undefined;
  const platform = await lookupAtOwner(slug, [], { ownerModel: 'default', locale: row.locale });
  return platform.template?.lens ?? undefined;
};

export const lookupLens = async (slug: string, ctx: OwnerScope): Promise<unknown> => {
  const row = await lookupTemplate(slug, ctx);
  return row ? templateLens(slug, row) : undefined;
};
