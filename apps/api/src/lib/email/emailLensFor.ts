/**
 * @atlas
 * @kind service
 * @partOf feature:email
 * @uses infrastructure:prisma, primitive:shared
 */

import { lensVisit } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import {
  type EmailOwnerRef,
  emailOwnerProvider,
  lookupLens,
  type OwnerScope,
} from '@template/email/render';
import {
  type EmailLens,
  emailLens,
  OPAQUE_SLOT,
  parseSlotLenses,
  scopeEmailLens,
} from '@template/email/rules';
import type { RuleLens } from '@template/shared/rules';
import { registry, type SenderSpec } from '#/lib/email/registry';
import type { Sender } from '#/lib/email/sender';
import { senderLensOwner } from '#/lib/email/senderLensOwner';

const senderLens = (sender: SenderSpec): RuleLens | null =>
  sender.type === 'platform' || sender.type === 'admin' ? null : lensFor(sender.type);

export const emailLensFor = (
  slug: string | undefined,
  owner: EmailOwnerRef,
  stored?: unknown,
  sender?: Sender,
): EmailLens => {
  const entry = slug ? registry[slug] : undefined;
  const lens = emailLens({
    sender: entry ? senderLens(entry.sender) : undefined,
    data: entry?.data,
    narrowing: parseSlotLenses(stored),
  });
  if (
    lens.recipient &&
    lens.recipient !== OPAQUE_SLOT &&
    !lensVisit(lens.recipient, '')?.fields.email
  )
    throw new Error('The recipient lens must keep `email`: delivery addresses the recipient by it');
  const scope = emailOwnerProvider(owner);
  return scopeEmailLens(lens, scope, (sender && senderLensOwner(sender)) ?? scope);
};

export const emailLensAt = async (slug: string, owner: OwnerScope): Promise<EmailLens> =>
  emailLensFor(slug, owner, await lookupLens(slug, owner));
