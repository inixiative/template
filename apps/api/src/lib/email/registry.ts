/**
 * @atlas
 * @kind registry
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';
import type { ReachContext } from '#/lib/email';

const eq = (field: string, value: unknown): Condition => ({ field, operator: 'equals', value }) as unknown as Condition;

type Source = Record<string, unknown>;

export type EmailEntry = {
  source: (data: Record<string, unknown>) => LensNarrowing;
  senders: (source: Source) => ReachContext[];
  recipients: (source: Source, sender: ReachContext) => LensNarrowing;
  data?: (source: Source, handoff: Record<string, unknown>) => Record<string, unknown>;
};

const userById = (id: unknown): LensNarrowing => ({
  parent: lensFor('User'),
  root: { where: eq('id', id), picks: ['id', 'name', 'email'] },
});

export const registry: Record<string, EmailEntry> = {
  'inquiry-invite-organization-user': {
    source: (data) => ({
      parent: lensFor('Inquiry'),
      root: {
        where: eq('id', data.inquiryId),
        picks: ['id', 'content', 'sourceOrganization'],
        relations: { sourceOrganization: { picks: ['name'] } },
      },
    }),
    senders: (inquiry) => [{ ownerModel: 'Organization', organizationId: inquiry.sourceOrganizationId as string }],
    recipients: (inquiry) => userById(inquiry.targetUserId),
  },

  welcome: {
    source: (data) => userById(data.userId),
    senders: () => [{ ownerModel: 'default' }],
    recipients: (user) => userById(user.id),
  },

  'email-verification': {
    source: (data) => userById(data.userId),
    senders: () => [{ ownerModel: 'default' }],
    recipients: (user) => userById(user.id),
    data: (_source, handoff) => ({ buttonUrl: handoff.buttonUrl, buttonText: 'Verify Email' }),
  },
};
