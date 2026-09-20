/**
 * @atlas
 * @kind registry
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { Condition, LensNarrowing, ModelNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import { fieldsLens, OPAQUE_SLOT, type SlotLens } from '@template/email/rules';
import type { RuleLens } from '@template/shared/rules';
import type { Sender } from '#/lib/email/sender';

export type SenderSpec = Sender;

export type RecipientTarget = { where: Condition };

export type RenderIssuePolicy = 'platform' | 'fail' | 'degrade';

export type RenderSpec = {
  onIssue?: RenderIssuePolicy;
  substitute?: string;
};

export type EmailEntry = {
  entity: LensNarrowing;
  sender: SenderSpec;
  recipients: RecipientTarget;
  cc?: RecipientTarget;
  bcc?: RecipientTarget;
  data: RuleLens;
  render?: RenderSpec;
};

export const recipientLens = (slot: SlotLens | undefined, where: Condition): LensNarrowing => {
  if (!slot || slot === OPAQUE_SLOT) throw new Error('Email recipient lens is not a model lens');
  return { parent: slot, root: { where } };
};

export const addressLens = (where: Condition): LensNarrowing => ({
  parent: lensFor('User'),
  root: { where, picks: ['email'] },
});

const user: ModelNarrowing = { picks: ['id', 'name', 'email'] };

const userEntity = (bind: string): LensNarrowing => ({
  parent: lensFor('User'),
  root: { where: { field: 'id', operator: 'equals', bind }, ...user },
});

const userData: LensNarrowing = { parent: lensFor('User'), root: user };

const inquiryInvite: ModelNarrowing = {
  picks: ['id', 'content', 'sourceOrganizationId', 'targetUserId', 'sourceOrganization'],
  relations: { sourceOrganization: { picks: ['name'] } },
};

const userRecipient = (bind: string): RecipientTarget => ({ where: { field: 'id', operator: 'equals', bind } });

const assertSubstitutes = (entries: Record<string, EmailEntry>): Record<string, EmailEntry> => {
  for (const [slug, entry] of Object.entries(entries)) {
    const substitute = entry.render?.substitute;
    if (substitute === undefined) continue;
    if (substitute === slug) throw new Error(`Email registry: "${slug}" names itself as its substitute`);
    const target = entries[substitute];
    if (!target) throw new Error(`Email registry: "${slug}" names an unregistered substitute "${substitute}"`);
    if (target.render?.substitute !== undefined) {
      throw new Error(`Email registry: substitute "${substitute}" of "${slug}" may not itself declare a substitute`);
    }
  }
  return entries;
};

export const registry: Record<string, EmailEntry> = assertSubstitutes({
  'inquiry-invite-organization-user': {
    entity: {
      parent: lensFor('Inquiry'),
      root: { where: { field: 'id', operator: 'equals', bind: 'inquiryId' }, ...inquiryInvite },
    },
    data: { parent: lensFor('Inquiry'), root: inquiryInvite },
    sender: { type: 'Organization', organizationId: 'sourceOrganizationId' },
    recipients: userRecipient('targetUserId'),
  },

  welcome: {
    entity: userEntity('userId'),
    data: userData,
    sender: { type: 'platform' },
    recipients: userRecipient('id'),
  },

  'email-verification': {
    entity: userEntity('userId'),
    sender: { type: 'platform' },
    recipients: userRecipient('id'),
    data: fieldsLens({ verificationUrl: 'String' }),
  },
});

export const renderPolicyFor = (
  slug: string,
): Required<Pick<RenderSpec, 'onIssue'>> & Pick<RenderSpec, 'substitute'> => ({
  onIssue: registry[slug]?.render?.onIssue ?? 'platform',
  substitute: registry[slug]?.render?.substitute,
});
