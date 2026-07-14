/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { EmailRenderError } from '@template/email/render/errors';
import { lookupCascade } from '@template/email/render/lookupCascade';
import { renderBlocks } from '@template/email/render/renderBlocks';
import type { OwnerScope } from '@template/email/render/types';

export const expand = async (mjml: string, ctx: OwnerScope): Promise<string> => {
  const cache = new Map<string, Promise<string>>();

  const load = (slug: string): Promise<string> => {
    const cached = cache.get(slug);
    if (cached) return cached;

    const pending = lookupCascade([slug], ctx).then((components) => {
      const component = components[slug];
      if (!component) throw new EmailRenderError(slug, 'component_missing');
      return component.mjml;
    });
    cache.set(slug, pending);
    return pending;
  };

  return renderBlocks(mjml, load);
};
