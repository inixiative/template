import type { CommunicationCategory } from '@template/db';
import { EmailRenderError } from '@template/email/render/errors';
import { expand } from '@template/email/render/expand';
import { lookupComponent, lookupTemplate } from '@template/email/render/lookupTemplate';
import type { SaveContext } from '@template/email/render/types';

export type ComposeContext = SaveContext;

export type ComposeTemplateResult = {
  mjml: string;
  subject: string;
  category: CommunicationCategory;
};

export type ComposeComponentResult = {
  mjml: string;
};

export const composeTemplate = async (slug: string, ctx: ComposeContext): Promise<ComposeTemplateResult> => {
  const template = await lookupTemplate(slug, ctx);
  if (!template) throw new EmailRenderError(slug, 'template_missing');

  const mjml = await expand(template.mjml, template.componentRefs, ctx);

  return { mjml, subject: template.subject, category: template.category };
};

export const composeComponent = async (slug: string, ctx: ComposeContext): Promise<ComposeComponentResult> => {
  const component = await lookupComponent(slug, ctx);
  if (!component) throw new EmailRenderError(slug, 'component_missing');

  const mjml = await expand(component.mjml, component.componentRefs, ctx);

  return { mjml };
};
