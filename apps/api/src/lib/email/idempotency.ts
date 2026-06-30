/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { stableHash } from '@template/shared/utils';
import type { Sender } from '#/lib/email/sender';

// Shared `{eventName}:{template}` prefix, hash last: a duplicate emit collapses, a changed payload re-sends.
export const plannerJobId = (eventName: string, template: string, data: unknown): string =>
  `${eventName}:${template}:${stableHash(data)}`;

export const deliverJobId = (
  eventName: string,
  template: string,
  sender: Sender,
  recipientEmail: string,
  contents: unknown,
): string => `${eventName}:${template}:${stableHash(sender)}:${recipientEmail}:${stableHash(contents)}`;
