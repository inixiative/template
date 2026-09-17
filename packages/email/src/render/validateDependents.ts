/**
 * @atlas
 * @kind validator
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db } from '@template/db';
import { DependentTemplateError, type DependentTemplateIssue } from '@template/email/errors/DependentTemplateError';
import { expand } from '@template/email/render/expand';
import { ownerCascade, ownerWhere } from '@template/email/render/owner';
import type { LensForSlug } from '@template/email/render/save';
import type { OwnerScope } from '@template/email/render/types';
import { validateTokens } from '@template/email/validations/validateTokens';

const embeddingTemplates = async (
  slugs: string[],
  ctx: OwnerScope,
): Promise<{ slug: string; mjml: string; subject: string }[]> => {
  const seen = new Set<string>();
  const templates: { slug: string; mjml: string; subject: string }[] = [];
  let frontier = slugs;
  while (frontier.length) {
    const next: string[] = [];
    for (const slug of frontier) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      const [components, owned] = await Promise.all([
        db.emailComponent.findMany({
          where: {
            OR: ownerCascade(ctx.ownerModel).map((tier) => ownerWhere(ctx, tier)),
            componentRefs: { has: slug },
          },
        }),
        db.emailTemplate.findMany({ where: { ...ownerWhere(ctx), componentRefs: { has: slug } } }),
      ]);
      next.push(...components.map((component) => component.slug));
      templates.push(...owned);
    }
    frontier = next;
  }
  return templates;
};

/**
 * A component save must keep every same-owner template that embeds it valid against that template's
 * own lens. Other owners' templates are stamped by the versioning hook, never refused here.
 */
export const validateDependents = async (
  componentSlug: string,
  savingTemplateSlug: string,
  ctx: OwnerScope,
  lensFor: LensForSlug,
): Promise<void> => {
  const broken: DependentTemplateIssue[] = [];
  for (const template of await embeddingTemplates([componentSlug], ctx)) {
    if (template.slug === savingTemplateSlug) continue;
    const lens = await lensFor(template.slug, ctx.locale);
    if (!lens) continue;
    const composed = await expand(template.mjml, ctx);
    const issues = [
      ...validateTokens(composed, { lens }),
      ...validateTokens(template.subject, { lens, isSubject: true }),
    ];
    if (issues.length) broken.push({ slug: template.slug, issues });
  }
  if (broken.length) throw new DependentTemplateError(componentSlug, broken);
};
