/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
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
};

export type ComposeComponentResult = {
  mjml: string;
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

  return {
    id: template.id,
    emailTemplateAuditLogId: template.auditLogs[0]?.id ?? null,
    mjml,
    subject: template.subject,
    kind: template.kind,
    ownerModel: template.ownerModel,
    componentResolutions,
  };
};

export const composeComponent = async (slug: string, ctx: OwnerScope): Promise<ComposeComponentResult> => {
  const component = await lookupComponent(slug, ctx);
  if (!component) throw new EmailRenderError(slug, 'component_missing');

  const mjml = await expand(component.mjml, ctx);

  return { mjml };
};
