/**
 * @atlas
 * @kind service
 * @partOf feature:email, primitive:messaging
 * @uses infrastructure:prisma
 */
import { fetchLens } from '@template/db/hydrate';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import {
  type InterpolateOptions,
  interpolate,
  type RuleErrorSink,
  type Variables,
} from '@template/email/render';
import type { EmailLens } from '@template/email/rules';
import { recipientLens } from '#/lib/email/registry';
import { resolveSender } from '#/lib/email/resolveSender';
import type { Sender } from '#/lib/email/sender';

export type RecipientRef = {
  recipientId: string;
  sender: Sender;
  data?: Record<string, unknown>;
  label?: string;
};

/** The recipient as the lens shows them when the send runs: the fetched re-check rows, never a queued copy. */
export const recipientVariables = async (
  lens: EmailLens,
  { recipientId, sender, data = {}, label = 'message' }: RecipientRef,
): Promise<Variables> => {
  const [recipient] = await fetchLens(
    recipientLens(lens.recipient, { field: 'id', operator: 'equals', value: recipientId }),
  );
  if (!recipient) throw new EmailRenderError(label, 'recipient_missing');
  return { sender: await resolveSender(sender), recipient, data };
};

export const renderForRecipient = (
  text: string,
  variables: Variables,
  lens: EmailLens,
  { onError, ...options }: Omit<InterpolateOptions, 'lens'> & { onError?: RuleErrorSink } = {},
): string => interpolate(text, variables, onError, { ...options, lens });
