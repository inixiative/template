/**
 * Resolve variants: match existing or suffix, rewrite MJML.
 */

import type { EmailComponent, EmailTemplate } from '@template/db';
import type { SaveContext } from './types';
import type { RefMap } from './extractRefs';

export type ResolveResult = {
  template: Partial<EmailTemplate>;
  components: Partial<EmailComponent>[];
};

export const resolveVariants = (
  map: RefMap,
  templateMjml: string,
  templateRefs: string[],
  existing: Record<string, EmailComponent | undefined>,
  ctx: SaveContext,
): ResolveResult => {
  const slugMap: Record<string, string> = {};
  const rawComponents: { slug: string; mjml: string; refs: string[] }[] = [];

  // 1. Assign final slugs to variants
  for (const [baseSlug, variants] of Object.entries(map)) {
    const existingComponent = existing[baseSlug];

    const matchedIdx = existingComponent
      ? variants.findIndex((v) => v.mjml === existingComponent.mjml)
      : -1;

    let suffixCounter = 1;
    for (let i = 0; i < variants.length; i++) {
      const ref = `${baseSlug}:${i}`;

      const finalSlug =
        i === matchedIdx || (!existingComponent && i === 0)
          ? baseSlug
          : `${baseSlug}-${suffixCounter++}`;

      slugMap[ref] = finalSlug;
      rawComponents.push({ slug: finalSlug, mjml: variants[i].mjml, refs: variants[i].refs });
    }
  }

  // 2. Rewrite template MJML and refs with final slugs (if template provided)
  const applyReplacements = (mjml: string, refs: string[]): { mjml: string; refs: string[] } => {
    let resultMjml = mjml;
    for (const [from, to] of Object.entries(slugMap)) {
      resultMjml = resultMjml
        .split(`{{#component:${from}}}`).join(`{{#component:${to}}}`)
        .split(`{{/component:${from}}}`).join(`{{/component:${to}}}`);
    }
    return {
      mjml: resultMjml,
      refs: refs.map((r) => slugMap[r] ?? r),
    };
  };

  let template: Partial<EmailTemplate> = {};
  if (templateMjml) {
    const { mjml, refs } = applyReplacements(templateMjml, templateRefs);
    template = { mjml, componentRefs: [...new Set(refs)] };
  }

  // 3. Build components with final slugs
  const components: Partial<EmailComponent>[] = rawComponents.map((c) => {
    const { mjml, refs } = applyReplacements(c.mjml, c.refs);
    return {
      slug: c.slug,
      locale: ctx.locale,
      mjml,
      componentRefs: refs,
    };
  });

  return { template, components };
};
