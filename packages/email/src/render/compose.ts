/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db, type RuleReferenceRow, ruleReferenceTargets } from '@template/db';
import type { CommunicationKind, EmailOwnerModel } from '@template/db/generated/client/client';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import {
  expandComponentTagsFromOwnerCascade,
  expandComponentTagsWithFetcher,
} from '@template/email/render/expandComponentTags';
import { fetchComponentsThroughOwnerCascade } from '@template/email/render/fetchComponentsThroughOwnerCascade';
import {
  fetchComponentThroughOwnerCascade,
  fetchTemplateLens,
  fetchTemplateThroughOwnerCascade,
} from '@template/email/render/fetchTemplateThroughOwnerCascade';
import { ownerScopeOfRow } from '@template/email/render/owner';
import type { OwnerScope } from '@template/email/render/types';
import type { RuleReference } from '@template/shared/rules';
import { uniqBy } from 'lodash-es';

export type ComposeTemplateResult = {
  id: string;
  emailTemplateAuditLogId: string | null;
  mjml: string;
  subject: string;
  kind: CommunicationKind;
  ownerModel: EmailOwnerModel;
  owner: OwnerScope;
  lens: unknown;
  componentResolutions: Record<string, string>;
  existingTargets: RuleReference[];
};

export type ComposeComponentResult = {
  mjml: string;
};

const existingTargetsOf = async (
  templateId: string,
  componentIds: string[],
): Promise<RuleReference[]> => {
  const edges = (await db.ruleReference.findMany({
    where: {
      OR: [
        { sourceEmailTemplateId: templateId },
        ...(componentIds.length ? [{ sourceEmailComponentId: { in: componentIds } }] : []),
      ],
    },
  })) as RuleReferenceRow[];
  return uniqBy(
    ruleReferenceTargets(edges).filter((target) => target.state === 'existing'),
    'key',
  ).map(({ model, id }) => ({ model, id }));
};

export const composeTemplate = async (
  slug: string,
  ctx: OwnerScope,
): Promise<ComposeTemplateResult> => {
  const template = await fetchTemplateThroughOwnerCascade(slug, ctx);
  if (!template) throw new EmailRenderError(slug, 'template_missing');

  const componentResolutions: Record<string, string> = {};
  const mjml = await expandComponentTagsWithFetcher(template.mjml, async (slugs) => {
    const components = await fetchComponentsThroughOwnerCascade(slugs, ctx);
    for (const componentSlug of slugs) {
      const component = components[componentSlug];
      if (component) componentResolutions[componentSlug] = component.id;
    }
    return components;
  });
  const existingTargets = await existingTargetsOf(template.id, [
    ...new Set(Object.values(componentResolutions)),
  ]);

  return {
    id: template.id,
    emailTemplateAuditLogId: template.auditLogs[0]?.id ?? null,
    mjml,
    subject: template.subject,
    kind: template.kind,
    ownerModel: template.ownerModel,
    owner: ownerScopeOfRow(template),
    lens: await fetchTemplateLens(slug, template),
    componentResolutions,
    existingTargets,
  };
};

export const composeComponent = async (
  slug: string,
  ctx: OwnerScope,
): Promise<ComposeComponentResult> => {
  const component = await fetchComponentThroughOwnerCascade(slug, ctx);
  if (!component) throw new EmailRenderError(slug, 'component_missing');

  const mjml = await expandComponentTagsFromOwnerCascade(component.mjml, ctx);

  return { mjml };
};
