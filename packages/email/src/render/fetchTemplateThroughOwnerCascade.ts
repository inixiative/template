/**
 * @atlas
 * @kind query
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { EmailComponent, EmailTemplate } from '@template/db/generated/client/client';
import {
  fetchEmailRowsAtOwner,
  type TemplateWithSnapshot,
} from '@template/email/render/fetchEmailRowsAtOwner';
import { fetchersPerOwnerTier, fetchFirstNonEmptyResult } from '@template/email/render/owner';
import type { OwnerScope } from '@template/email/render/types';

export const fetchTemplateThroughOwnerCascade = (
  slug: string,
  ctx: OwnerScope,
): Promise<TemplateWithSnapshot | null> =>
  fetchFirstNonEmptyResult(
    fetchersPerOwnerTier(ctx, (tier) =>
      fetchEmailRowsAtOwner(slug, [], ctx, tier).then((r) => r.template),
    ),
  );

export const fetchComponentThroughOwnerCascade = (
  slug: string,
  ctx: OwnerScope,
): Promise<EmailComponent | null> =>
  fetchFirstNonEmptyResult(
    fetchersPerOwnerTier(ctx, (tier) =>
      fetchEmailRowsAtOwner(null, [slug], ctx, tier).then((r) =>
        Object.hasOwn(r.components, slug) ? r.components[slug] : null,
      ),
    ),
  );

export const fetchTemplateLens = async (
  slug: string,
  row: Pick<EmailTemplate, 'lens' | 'ownerModel' | 'locale'>,
): Promise<unknown> => {
  if (row.lens != null || row.ownerModel === 'default') return row.lens ?? undefined;
  const platform = await fetchEmailRowsAtOwner(slug, [], {
    ownerModel: 'default',
    locale: row.locale,
  });
  return platform.template?.lens ?? undefined;
};

export const fetchLensThroughOwnerCascade = async (
  slug: string,
  ctx: OwnerScope,
): Promise<unknown> => {
  const row = await fetchTemplateThroughOwnerCascade(slug, ctx);
  return row ? fetchTemplateLens(slug, row) : undefined;
};
