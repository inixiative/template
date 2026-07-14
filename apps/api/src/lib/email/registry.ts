/**
 * @atlas
 * @kind registry
 * @partOf feature:email
 * @uses infrastructure:prisma
 */
import type { Condition, LensNarrowing } from '@inixiative/json-rules';
import { lensFor } from '@template/db/lens';

// A bind name → a path into the resolution context available when it resolves.
// entity binds read `{ data }` (the handoff); sender reads `{ entity }`;
// recipients read `{ entity, sender }`; data reads `{ entity, handoff }`.
export type BindSources = Record<string, string>;

// The subject-model query. `narrowing.root.where` carries `{ bind }` tokens; `bindings`
// declares where each token's value comes from. Declarative + serializable — no closures.
export type EntitySpec = { narrowing: LensNarrowing; bindings: BindSources };

// Which sender identity to construct; id fields are bound from the resolved entity.
export type SenderSpec =
  | { type: 'platform' }
  | { type: 'admin' }
  | { type: 'User'; bindings: { userId: string } }
  | { type: 'Organization'; bindings: { organizationId: string } }
  | { type: 'Space'; bindings: { spaceId: string; organizationId: string } }
  | { type: 'OrganizationUser'; bindings: { userId: string; organizationId: string } }
  | { type: 'SpaceUser'; bindings: { userId: string; spaceId: string; organizationId: string } };

// Recipients are always User-rooted. `picks`/`relations` are the static interpolation surface
// (known at save time); `where` carries `{ bind }` tokens filled from `bindings`.
export type RecipientSpec = {
  picks: string[];
  relations?: Record<string, { picks: string[] }>;
  where: Condition;
  bindings: BindSources;
};

export type EmailEntry = {
  entity: EntitySpec;
  sender: SenderSpec;
  recipients: RecipientSpec;
  cc?: RecipientSpec;
  bcc?: RecipientSpec;
  data?: BindSources;
};

// Assemble a User-rooted recipient narrowing from the static surface + a resolved where.
export const recipientLens = (spec: RecipientSpec, where: Condition): LensNarrowing => ({
  parent: lensFor('User'),
  root: {
    where,
    picks: spec.picks,
    ...(spec.relations ? { relations: spec.relations } : {}),
  },
});

const eqBind = (field: string, bind: string): Condition => ({ field, operator: 'equals', bind }) as unknown as Condition;

const userEntity = (path: string): EntitySpec => ({
  narrowing: { parent: lensFor('User'), root: { where: eqBind('id', 'userId'), picks: ['id', 'name', 'email'] } },
  bindings: { userId: path },
});

const userRecipient = (path: string): RecipientSpec => ({
  picks: ['id', 'name', 'email'],
  where: eqBind('id', 'recipientId'),
  bindings: { recipientId: path },
});

export const registry: Record<string, EmailEntry> = {
  'inquiry-invite-organization-user': {
    entity: {
      narrowing: {
        parent: lensFor('Inquiry'),
        root: {
          where: eqBind('id', 'inquiryId'),
          picks: ['id', 'content', 'sourceOrganization'],
          relations: { sourceOrganization: { picks: ['name'] } },
        },
      },
      bindings: { inquiryId: 'data.inquiryId' },
    },
    sender: { type: 'Organization', bindings: { organizationId: 'entity.sourceOrganizationId' } },
    recipients: userRecipient('entity.targetUserId'),
  },

  welcome: {
    entity: userEntity('data.userId'),
    sender: { type: 'platform' },
    recipients: userRecipient('entity.id'),
  },

  'email-verification': {
    entity: userEntity('data.userId'),
    sender: { type: 'platform' },
    recipients: userRecipient('entity.id'),
    data: { verificationUrl: 'handoff.verificationUrl' },
  },
};
