/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 */
const SECTION_ATTR = 'data-section';

export function resolveSectionTarget(sectionId: string): Element | null {
  const dotIndex = sectionId.indexOf('.');
  if (dotIndex === -1) {
    return document.querySelector(`[${SECTION_ATTR}="${CSS.escape(sectionId)}"]`);
  }

  const parentId = sectionId.slice(0, dotIndex);
  const childKey = sectionId.slice(dotIndex + 1);

  const parent = document.querySelector(`[${SECTION_ATTR}="${CSS.escape(parentId)}"]`);
  if (!parent) return null;

  // Try by data-key first.
  const byKey = parent.querySelector(`[data-key="${CSS.escape(childKey)}"]`);
  if (byKey) return byKey;

  // Fall back to numeric index into data-key children.
  const numIndex = Number.parseInt(childKey, 10);
  if (!Number.isNaN(numIndex)) {
    const children = parent.querySelectorAll('[data-key]');
    if (numIndex >= 0 && numIndex < children.length) {
      return children[numIndex];
    }
  }

  return null;
}
