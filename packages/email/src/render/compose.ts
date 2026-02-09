/**
 * Compose - fetch template/component and expand all refs into full MJML.
 */

import type { CommunicationCategory } from '@template/db';
import { EmailRenderError } from './errors';
import { expand } from './expand';
import { lookupComponent, lookupTemplate } from './lookupTemplate';
import type { SaveContext } from './types';

/** Reuse SaveContext - same shape needed for compose */
export type ComposeContext = SaveContext;

export type ComposeTemplateResult = {
  mjml: string;
  subject: string;
  category: CommunicationCategory;
};

export type ComposeComponentResult = {
  mjml: string;
};

/**
 * Compose a template - fetch and expand all component refs.
 */
export const composeTemplate = async (slug: string, ctx: ComposeContext): Promise<ComposeTemplateResult> => {
  const template = await lookupTemplate(slug, ctx);
  if (!template) throw new EmailRenderError(slug, 'template_missing');

  const mjml = await expand(template.mjml, template.componentRefs, ctx);

  return { mjml, subject: template.subject, category: template.category };
};

/**
 * Compose a component - fetch and expand nested refs (for component editor preview).
 */
export const composeComponent = async (slug: string, ctx: ComposeContext): Promise<ComposeComponentResult> => {
  const component = await lookupComponent(slug, ctx);
  if (!component) throw new EmailRenderError(slug, 'component_missing');

  const mjml = await expand(component.mjml, component.componentRefs, ctx);

  return { mjml };
};
