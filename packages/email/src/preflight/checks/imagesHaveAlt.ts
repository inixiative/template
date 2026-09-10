/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses none
 */
import type { SyncPreflightCheck } from '@template/email/preflight/types';
import { parse } from 'node-html-parser';

export const imagesHaveAlt: SyncPreflightCheck = ({ html }) =>
  parse(html)
    .querySelectorAll('img')
    .filter((image) => !(image.getAttribute('alt') ?? '').trim())
    .map((image) => ({
      code: 'image.alt.missing',
      severity: 'warning' as const,
      message: 'An image has no alt text — it reads as nothing when images are blocked or read aloud.',
      location: image.getAttribute('src') ?? 'html',
    }));
