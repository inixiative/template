/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import {
  expandComponentTagsWithLookup,
  type LookupComponents,
} from '@template/email/render/expandComponentTags';

export const fetchMissingComponentSlugs = async (
  mjml: string,
  lookup: LookupComponents,
): Promise<string[]> => {
  const missing = new Set<string>();
  await expandComponentTagsWithLookup(mjml, lookup, {
    onRenderFailure: (error) => {
      if (error.type === 'component_missing') missing.add(error.slug);
    },
  });
  return [...missing].sort();
};
