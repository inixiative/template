/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import { convert, type HtmlToTextOptions } from 'html-to-text';

const OPTIONS: HtmlToTextOptions = {
  wordwrap: false,
  formatters: {
    imageAlt: (elem, _walk, builder) => {
      const alt = (elem.attribs?.alt ?? '').trim();
      if (alt) builder.addInline(alt);
    },
  },
  selectors: [
    { selector: 'a', options: { hideLinkHrefIfSameAsText: true, linkBrackets: ['(', ')'] } },
    { selector: 'img', format: 'imageAlt' },
    // rendered MJML is built from layout tables; the 60-char default column would rewrap body copy
    { selector: 'table', format: 'dataTable', options: { maxColumnWidth: Number.MAX_SAFE_INTEGER } },
  ],
};

export const deriveTextFromHtml = (html: string): string =>
  convert(html, OPTIONS)
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
