/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
export type EmailErrorType =
  | 'component_missing'
  | 'template_missing'
  | 'circular_ref'
  | 'render_failed'
  | 'unsubscribe_unavailable';

const message = (slug: string, type: EmailErrorType, path?: string[]): string => {
  switch (type) {
    case 'component_missing':
      return `Component not found: ${slug}`;
    case 'template_missing':
      return `Template not found: ${slug}`;
    case 'circular_ref':
      return path?.length ? `Circular reference detected: ${path.join(' → ')}` : `Circular reference detected: ${slug}`;
    case 'render_failed':
      return path?.length ? `Template render failed: ${slug} — ${path.join('; ')}` : `Template render failed: ${slug}`;
    case 'unsubscribe_unavailable':
      return `Template ${slug} is not a system email and the recipient has no contact to unsubscribe`;
  }
};

export class EmailRenderError extends Error {
  constructor(
    readonly slug: string,
    readonly type: EmailErrorType,
    readonly path?: string[],
  ) {
    super(message(slug, type, path));
    this.name = 'EmailRenderError';
  }
}
