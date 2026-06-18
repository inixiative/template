/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses none
 */
import { stableHash } from '@template/shared/utils';

// Shared `{eventName}:{template}` prefix, hash last: a duplicate emit collapses, a changed payload re-sends.
export const plannerJobId = (eventName: string, template: string, data: unknown): string =>
  `${eventName}:${template}:${stableHash(data)}`;

export const deliverJobId = (
  eventName: string,
  template: string,
  senderKey: string,
  recipientEmail: string,
  contents: unknown,
): string => `${eventName}:${template}:${senderKey}:${recipientEmail}:${stableHash(contents)}`;
