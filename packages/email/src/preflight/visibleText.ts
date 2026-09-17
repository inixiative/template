/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { parse } from 'node-html-parser';

export const visibleText = (html: string): string => {
  const root = parse(html);
  for (const node of root.querySelectorAll('script, style')) node.remove();
  return root.text.replace(/\s+/g, ' ').trim();
};
