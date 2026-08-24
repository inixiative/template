/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import type { CommunicationKind, EmailErrorPolicy, EmailOwnerModel } from '@template/db/generated/client/client';
import { EmailRenderError } from '@template/email/render/errors';
import { expand } from '@template/email/render/expand';
import { lookupComponent, lookupTemplate } from '@template/email/render/lookupTemplate';
import type { OwnerScope } from '@template/email/render/types';

export type ComposeTemplateResult = {
  id: string;
  emailTemplateAuditLogId: string | null; // latest snapshot, read with the template so the send pin matches what rendered
  mjml: string;
  subject: string;
  kind: CommunicationKind;
  ownerModel: EmailOwnerModel; // where the cascade actually resolved (may differ from the requested owner)
  onError: EmailErrorPolicy; // render-error policy for the resolved template
};

// The next owner up the cascade, used to re-compose on a `fallback` render error. Two chains:
// user (SpaceUser→OrganizationUser→User→default) and org (Space→Organization→default); admin/default have no parent.
export const parentOwner = (owner: EmailOwnerModel): EmailOwnerModel | null => {
  switch (owner) {
    case 'SpaceUser':
      return 'OrganizationUser';
    case 'OrganizationUser':
      return 'User';
    case 'User':
      return 'default';
    case 'Space':
      return 'Organization';
    case 'Organization':
      return 'default';
    default:
      return null;
  }
};

export type ComposeComponentResult = {
  mjml: string;
};

export const composeTemplate = async (slug: string, ctx: OwnerScope): Promise<ComposeTemplateResult> => {
  const template = await lookupTemplate(slug, ctx);
  if (!template) throw new EmailRenderError(slug, 'template_missing');

  const mjml = await expand(template.mjml, template.componentRefs, ctx);

  return {
    id: template.id,
    emailTemplateAuditLogId: template.auditLogs[0]?.id ?? null,
    mjml,
    subject: template.subject,
    kind: template.kind,
    ownerModel: template.ownerModel,
    onError: template.onError,
  };
};

export const composeComponent = async (slug: string, ctx: OwnerScope): Promise<ComposeComponentResult> => {
  const component = await lookupComponent(slug, ctx);
  if (!component) throw new EmailRenderError(slug, 'component_missing');

  const mjml = await expand(component.mjml, component.componentRefs, ctx);

  return { mjml };
};
