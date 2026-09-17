/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
export class DivergentDuplicateSlugError extends Error {
  constructor(readonly slug: string) {
    super(`Component slug "${slug}" appears more than once in this save payload with different inlined bodies.`);
    this.name = 'DivergentDuplicateSlugError';
  }
}
