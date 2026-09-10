/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import { db, liveRuleReferenceKeys, type RuleReferenceRow } from '@template/db';
import type { CommunicationKind, EmailOwnerModel } from '@template/db/generated/client/client';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import { expand, expandWith } from '@template/email/render/expand';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { lookupComponent, lookupTemplate } from '@template/email/render/lookupTemplate';
import type { OwnerScope } from '@template/email/render/types';

export type ComposeTemplateResult = {
  id: string;
  emailTemplateAuditLogId: string | null;
  mjml: string;
  subject: string;
  kind: CommunicationKind;
  ownerModel: EmailOwnerModel;
  componentResolutions: Record<string, string>;
  liveRuleRefs: Set<string>;
};

export type ComposeComponentResult = {
  mjml: string;
};

const liveRuleReferencesOf = async (templateId: string, componentIds: string[]): Promise<Set<string>> => {
  const edges = (await db.ruleReference.findMany({
    where: {
      OR: [
        { emailTemplateId: templateId },
        ...(componentIds.length ? [{ emailComponentId: { in: componentIds } }] : []),
      ],
    },
  })) as RuleReferenceRow[];
  return liveRuleReferenceKeys(edges);
};

export const composeTemplate = async (slug: string, ctx: OwnerScope): Promise<ComposeTemplateResult> => {
  const template = await lookupTemplate(slug, ctx);
  if (!template) throw new EmailRenderError(slug, 'template_missing');

  const componentResolutions: Record<string, string> = {};
  const mjml = await expandWith(template.mjml, async (slugs) => {
    const components = await lookupCascade(slugs, ctx);
    for (const componentSlug of slugs) {
      const component = components[componentSlug];
      if (component) componentResolutions[componentSlug] = component.id;
    }
    return components;
  });
  const liveRuleRefs = await liveRuleReferencesOf(template.id, [...new Set(Object.values(componentResolutions))]);

  return {
    id: template.id,
    emailTemplateAuditLogId: template.auditLogs[0]?.id ?? null,
    mjml,
    subject: template.subject,
    kind: template.kind,
    ownerModel: template.ownerModel,
    componentResolutions,
    liveRuleRefs,
  };
};

export const composeComponent = async (slug: string, ctx: OwnerScope): Promise<ComposeComponentResult> => {
  const component = await lookupComponent(slug, ctx);
  if (!component) throw new EmailRenderError(slug, 'component_missing');

  const mjml = await expand(component.mjml, ctx);

  return { mjml };
};
