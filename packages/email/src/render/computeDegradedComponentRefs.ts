/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { expandWith, type LookupComponents } from '@template/email/render/expand';

export const computeDegradedComponentRefs = async (
  mjml: string,
  lookup: LookupComponents,
): Promise<string[]> => {
  const missing = new Set<string>();
  await expandWith(mjml, lookup, {
    onRenderFailure: (error) => {
      if (error.type === 'component_missing') missing.add(error.slug);
    },
  });
  return [...missing].sort();
};
