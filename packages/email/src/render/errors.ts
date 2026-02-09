/**
 * Errors for email rendering pipeline.
 */

export type EmailErrorType = 'component_missing' | 'template_missing' | 'circular_ref';

export class EmailRenderError extends Error {
  readonly slug: string;
  readonly type: EmailErrorType;

  constructor(slug: string, type: EmailErrorType) {
    super(EmailRenderError.getMessage(slug, type));
    this.name = 'EmailRenderError';
    this.slug = slug;
    this.type = type;
  }

  private static getMessage(slug: string, type: EmailErrorType): string {
    switch (type) {
      case 'component_missing':
        return `Component not found: ${slug}`;
      case 'template_missing':
        return `Template not found: ${slug}`;
      case 'circular_ref':
        return `Circular reference detected: ${slug}`;
    }
  }
}
