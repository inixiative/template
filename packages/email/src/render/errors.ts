/**
 * @atlas
 * @kind constructor
 * @partOf feature:email
 * @uses none
 */
export type EmailErrorType = 'component_missing' | 'template_missing' | 'circular_ref' | 'render_failed';

export class EmailRenderError extends Error {
  readonly slug: string;
  readonly type: EmailErrorType;
  readonly path?: string[];

  constructor(slug: string, type: EmailErrorType, path?: string[]) {
    super(EmailRenderError.getMessage(slug, type, path));
    this.name = 'EmailRenderError';
    this.slug = slug;
    this.type = type;
    this.path = path;
  }

  private static getMessage(slug: string, type: EmailErrorType, path?: string[]): string {
    switch (type) {
      case 'component_missing':
        return `Component not found: ${slug}`;
      case 'template_missing':
        return `Template not found: ${slug}`;
      case 'circular_ref':
        return path && path.length > 0
          ? `Circular reference detected: ${path.join(' → ')}`
          : `Circular reference detected: ${slug}`;
      case 'render_failed':
        return `Template render failed (unrenderable conditional rule): ${slug}`;
    }
  }
}
