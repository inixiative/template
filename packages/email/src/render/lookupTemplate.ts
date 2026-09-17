/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailComponent } from '@template/db/generated/client/client';
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
