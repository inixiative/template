/**
 * @atlas
 * @kind service
 * @partOf feature:email, primitive:messaging
 * @uses infrastructure:prisma
 */
import type { Condition } from '@inixiative/json-rules';
import { fetchLens } from '@template/db/hydrate';
import { EmailRenderError } from '@template/email/errors/EmailRenderError';
import {
  type InterpolateOptions,
  interpolate,
  type RuleErrorSink,
  type Variables,
} from '@template/email/render';
import { declaredFields, type EmailLens, OPAQUE_SLOT } from '@template/email/rules';
import { slotRowsLens } from '#/lib/email/registry';
import { resolveSender } from '#/lib/email/resolveSender';
import type { Sender } from '#/lib/email/sender';

export type RecipientRef = {
  recipientId: string;
  sender: Sender;
  data?: Record<string, unknown>;
  label?: string;
};

const byId = (id: string): Condition => ({ field: 'id', operator: 'equals', value: id });

const dataVariables = async (
  lens: EmailLens,
  data: Record<string, unknown>,
  label: string,
): Promise<Record<string, unknown>> => {
  const slot = lens.data;
  if (!slot || slot === OPAQUE_SLOT || declaredFields(slot)) return data;
  if (typeof data.id !== 'string')
    throw new EmailRenderError(label, 'render_failed', [
      'the data slot is a model lens and its payload carries no id',
    ]);
  const [row] = await fetchLens(slotRowsLens(slot, byId(data.id)));
  if (!row) throw new EmailRenderError(label, 'data_missing');
  return row;
};

/** The recipient and the data entity as the lens shows them when the send runs: the fetched re-check rows, never a queued copy. */
export const recipientVariables = async (
  lens: EmailLens,
  { recipientId, sender, data = {}, label = 'message' }: RecipientRef,
): Promise<Variables> => {
  const [recipient] = await fetchLens(slotRowsLens(lens.recipient, byId(recipientId)));
  if (!recipient) throw new EmailRenderError(label, 'recipient_missing');
  return {
    sender: await resolveSender(sender),
    recipient,
    data: await dataVariables(lens, data, label),
  };
};

export const renderForRecipient = (
  text: string,
  variables: Variables,
  lens: EmailLens,
  { onError, ...options }: Omit<InterpolateOptions, 'lens'> & { onError?: RuleErrorSink } = {},
): string => interpolate(text, variables, onError, { ...options, lens });
