/**
 * @atlas
 * @kind registry
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import type { Sender } from '#/lib/email/sender';

export type SenderSpec = Sender;

export type RecipientSpec = {
  picks: string[];
  relations?: Record<string, { picks: string[] }>;
  where: Condition;
};

export type RenderIssuePolicy = 'fail' | 'degrade';

export type RenderSpec = {
  onIssue?: RenderIssuePolicy;
  substitute?: string;
};

export type EmailEntry = {
  entity: LensNarrowing;
  sender: SenderSpec;
  recipients: RecipientSpec;
  cc?: RecipientSpec;
  bcc?: RecipientSpec;
  data?: string[];
  render?: RenderSpec;
};

export const recipientLens = (spec: RecipientSpec, where: Condition): LensNarrowing => ({
  parent: lensFor('User'),
  root: {
    where,
    picks: spec.picks,
    ...(spec.relations ? { relations: spec.relations } : {}),
  },
});

const userEntity = (bind: string): LensNarrowing => ({
  parent: lensFor('User'),
  root: { where: { field: 'id', operator: 'equals', bind }, picks: ['id', 'name', 'email'] },
});

const userRecipient = (bind: string): RecipientSpec => ({
  picks: ['id', 'name', 'email'],
  where: { field: 'id', operator: 'equals', bind },
});

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
      root: {
        where: { field: 'id', operator: 'equals', bind: 'inquiryId' },
        picks: ['id', 'content', 'sourceOrganizationId', 'targetUserId', 'sourceOrganization'],
        relations: { sourceOrganization: { picks: ['name'] } },
      },
    },
    sender: { type: 'Organization', organizationId: 'sourceOrganizationId' },
    recipients: userRecipient('targetUserId'),
  },

  welcome: {
    entity: userEntity('userId'),
    sender: { type: 'platform' },
    recipients: userRecipient('id'),
  },

  'email-verification': {
    entity: userEntity('userId'),
    sender: { type: 'platform' },
    recipients: userRecipient('id'),
    data: ['verificationUrl'],
  },
});

export const renderPolicyFor = (
  slug: string,
): Required<Pick<RenderSpec, 'onIssue'>> & Pick<RenderSpec, 'substitute'> => ({
  onIssue: registry[slug]?.render?.onIssue ?? 'fail',
  substitute: registry[slug]?.render?.substitute,
});
