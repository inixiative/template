/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import type { CommunicationCategory, EmailErrorPolicy, EmailOwnerModel } from '@template/db';
import { EmailRenderError } from '@template/email/render/errors';
import { expand } from '@template/email/render/expand';
import { lookupComponent, lookupTemplate } from '@template/email/render/lookupTemplate';
import type { SaveContext } from '@template/email/render/types';

export type ComposeContext = SaveContext;

export type ComposeTemplateResult = {
  mjml: string;
  subject: string;
  category: CommunicationCategory;
  ownerModel: EmailOwnerModel; // where the cascade actually resolved (may differ from the requested owner)
  onError: EmailErrorPolicy; // render-error policy for the resolved template
};

// The next owner up the inheritance cascade, used to re-compose on a `fallback` render error.
// Space → Organization → default; base owners (default/admin) have no parent and always fail.
export const parentOwner = (owner: EmailOwnerModel): EmailOwnerModel | null =>
  owner === 'Space' ? 'Organization' : owner === 'Organization' ? 'default' : null;

export type ComposeComponentResult = {
  mjml: string;
};

export const composeTemplate = async (slug: string, ctx: ComposeContext): Promise<ComposeTemplateResult> => {
  const template = await lookupTemplate(slug, ctx);
  if (!template) throw new EmailRenderError(slug, 'template_missing');

  const mjml = await expand(template.mjml, template.componentRefs, ctx);

  return {
    mjml,
    subject: template.subject,
    category: template.category,
    ownerModel: template.ownerModel,
    onError: template.onError,
  };
};

export const composeComponent = async (slug: string, ctx: ComposeContext): Promise<ComposeComponentResult> => {
  const component = await lookupComponent(slug, ctx);
  if (!component) throw new EmailRenderError(slug, 'component_missing');

  const mjml = await expand(component.mjml, component.componentRefs, ctx);

  return { mjml };
};
