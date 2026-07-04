/**
 * @atlas
 * @kind registry
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import type { Inquiry, User } from '@template/db/generated/client/client';
import { lensFor } from '@template/db/lens';
import type { Sender } from '#/lib/email/sender';

const eq = (field: string, value: unknown): Condition => ({ field, operator: 'equals', value }) as unknown as Condition;

type Row = Record<string, unknown>;

export type RecipientDefinition<E = Row> = {
  picks: string[];
  relations?: Record<string, { picks: string[] }>;
  where: (entity: E, sender: Sender) => Condition;
};

export type EmailEntry<E = Row> = {
  entity: (data: Record<string, unknown>) => LensNarrowing;
  sender: (entity: E) => Sender;
  recipients: RecipientDefinition<E>;
  cc?: (recipient: Row, sender: Sender) => LensNarrowing;
  bcc?: (recipient: Row, sender: Sender) => LensNarrowing;
  data?: (entity: E, handoff: Record<string, unknown>) => Record<string, unknown>;
};

export const recipientLens = (recipients: RecipientDefinition, entity: Row, sender: Sender): LensNarrowing => ({
  parent: lensFor('User'),
  root: {
    where: recipients.where(entity, sender),
    picks: recipients.picks,
    ...(recipients.relations ? { relations: recipients.relations } : {}),
  },
});

const defineEntry = <E>(entry: EmailEntry<E>): EmailEntry => entry as EmailEntry;

const userById = (id: unknown): LensNarrowing => ({
  parent: lensFor('User'),
  root: { where: eq('id', id), picks: ['id', 'name', 'email'] },
});

const userRecipient = <E>(idOf: (entity: E) => unknown): RecipientDefinition<E> => ({
  picks: ['id', 'name', 'email'],
  where: (entity) => eq('id', idOf(entity)),
});

export const registry: Record<string, EmailEntry> = {
  'inquiry-invite-organization-user': defineEntry<Inquiry & { sourceOrganizationId: string }>({
    entity: (data) => ({
      parent: lensFor('Inquiry'),
      root: {
        where: eq('id', data.inquiryId),
        picks: ['id', 'content', 'sourceOrganization'],
        relations: { sourceOrganization: { picks: ['name'] } },
      },
    }),
    sender: (inquiry) => ({ type: 'Organization', organizationId: inquiry.sourceOrganizationId }),
    recipients: userRecipient((inquiry) => inquiry.targetUserId),
  }),

  welcome: defineEntry<User>({
    entity: (data) => userById(data.userId),
    sender: () => ({ type: 'platform' }),
    recipients: userRecipient((user) => user.id),
  }),

  'email-verification': defineEntry<User>({
    entity: (data) => userById(data.userId),
    sender: () => ({ type: 'platform' }),
    recipients: userRecipient((user) => user.id),
    data: (_user, handoff) => ({ verificationUrl: handoff.verificationUrl }),
  }),
};
