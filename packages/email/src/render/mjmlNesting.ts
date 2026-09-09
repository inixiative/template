/**
 * @atlas
 * @kind constant
 * @partOf feature:email
 * @uses none
 */
export const MJML_CHILD_TAGS: Readonly<Record<string, readonly string[]>> = {
  'mj-accordion': ['mj-accordion-element', 'mj-raw'],
  'mj-accordion-element': ['mj-accordion-title', 'mj-accordion-text', 'mj-raw'],
  'mj-accordion-text': [],
  'mj-accordion-title': [],
  'mj-body': ['mj-raw', 'mj-section', 'mj-wrapper', 'mj-hero'],
  'mj-button': [],
  'mj-carousel': ['mj-carousel-image'],
  'mj-carousel-image': [],
  'mj-column': [
    'mj-accordion',
    'mj-button',
    'mj-carousel',
    'mj-divider',
    'mj-image',
    'mj-raw',
    'mj-social',
    'mj-spacer',
    'mj-table',
    'mj-text',
    'mj-navbar',
  ],
  'mj-divider': [],
  'mj-group': ['mj-column', 'mj-raw'],
  'mj-head': [
    'mj-attributes',
    'mj-breakpoint',
    'mj-html-attributes',
    'mj-font',
    'mj-preview',
    'mj-style',
    'mj-title',
    'mj-raw',
  ],
  'mj-hero': [
    'mj-accordion',
    'mj-button',
    'mj-carousel',
    'mj-divider',
    'mj-image',
    'mj-social',
    'mj-spacer',
    'mj-table',
    'mj-text',
    'mj-navbar',
    'mj-raw',
  ],
  'mj-html-attribute': [],
  'mj-html-attributes': ['mj-selector'],
  'mj-image': [],
  'mj-navbar': ['mj-navbar-link', 'mj-raw'],
  'mj-raw': [],
  'mj-section': ['mj-column', 'mj-group', 'mj-raw'],
  'mj-selector': ['mj-html-attribute'],
  'mj-social': ['mj-social-element', 'mj-raw'],
  'mj-social-element': [],
  'mj-spacer': [],
  'mj-table': [],
  'mj-text': [],
  'mj-wrapper': ['mj-hero', 'mj-raw', 'mj-section'],
  mjml: ['mj-body', 'mj-head', 'mj-raw'],
};

export const canNestMjml = (parent: string | null, child: string): boolean => {
  if (!parent) return true;
  const allowed = MJML_CHILD_TAGS[parent];
  return allowed === undefined || allowed.includes(child);
};
