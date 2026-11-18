/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import {
  expandComponentTagsWithFetcher,
  type FetchComponents,
} from '@template/email/render/expandComponentTags';

export const fetchMissingComponentSlugs = async (
  mjml: string,
  lookup: FetchComponents,
): Promise<string[]> => {
  const missing = new Set<string>();
  await expandComponentTagsWithFetcher(mjml, lookup, {
    onRenderFailure: (error) => {
      if (error.type === 'component_missing') missing.add(error.slug);
    },
  });
  return [...missing].sort();
};
