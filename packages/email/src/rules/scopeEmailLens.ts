/**
 * @atlas
 * @kind helper
 * @partOf feature:email
 * @uses primitive:shared
 */
import {
  bindLens,
  type Condition,
  clampLens,
  type NarrowingDefaults,
  Operator,
} from '@inixiative/json-rules';
import { polymorphicBindings, polymorphicIs } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { boundAndLive, platformOrBound, through } from '@template/db/lens';
import { type EmailLens, narrowEmailLens } from '@template/email/rules/emailLens';
import type { RuleLens } from '@template/shared/rules';

export type EmailLensOwner = {
  ownerModel: ProviderModel;
  ownerId: string;
  organizationId?: string | null;
} | null;

const tag = platformOrBound('Tag', 'ownerModel');
const segment = boundAndLive('Segment', 'ownerModel');
const customerRef = polymorphicIs('CustomerRef', 'providerModel');
const platformDefaults: NarrowingDefaults['models'] = {
  Tag: { where: tag, sources: { id: { where: tag } } },
  Segment: { where: segment, sources: { id: { where: segment } } },
  TagAttachment: { where: through('tag', tag) },
  SegmentMember: { where: through('segment', segment) },
  CustomerRef: { where: customerRef },
};

const boundTo = (field: string, bind: string): Condition => ({
  field,
  operator: Operator.equals,
  bind,
  bindOptional: true,
});

const scopedTo = (where: Condition) => ({ where, sources: { id: { where } } });

/** The owner-side model defaults per owner kind; every owner id is a bind token. */
export const EMAIL_OWNER_SCOPES: Record<ProviderModel, NarrowingDefaults['models']> = {
  Organization: {
    Organization: scopedTo(boundTo('id', 'organizationId')),
    Space: scopedTo(boundTo('organizationId', 'organizationId')),
  },
  Space: {
    Organization: scopedTo(boundTo('id', 'ownerOrganizationId')),
    Space: scopedTo(boundTo('id', 'spaceId')),
  },
  User: {
    Organization: scopedTo(boundTo('id', 'ownerOrganizationId')),
    Space: scopedTo(false),
  },
};

/** The membership defaults per sender kind; the sender's organization is a bind token. */
export const EMAIL_SENDER_SCOPES: Record<ProviderModel, NarrowingDefaults['models']> = {
  Organization: {
    OrganizationUser: { where: boundTo('organizationId', 'senderOrganizationId') },
    SpaceUser: { where: boundTo('organizationId', 'senderOrganizationId') },
  },
  Space: {
    OrganizationUser: { where: boundTo('organizationId', 'senderOrganizationId') },
    SpaceUser: { where: boundTo('organizationId', 'senderOrganizationId') },
  },
  User: { OrganizationUser: { where: false }, SpaceUser: { where: false } },
};

type Owner = NonNullable<EmailLensOwner>;

/** The values an owner and a sender supply to the static scopes' bind tokens. */
export const emailLensBindings = (
  owner: EmailLensOwner,
  sender: EmailLensOwner,
): Record<string, string> => ({
  ...(owner ? polymorphicBindings(owner.ownerModel, owner.ownerId) : {}),
  ...(owner?.organizationId ? { ownerOrganizationId: owner.organizationId } : {}),
  ...(sender && senderOrganizationId(sender)
    ? { senderOrganizationId: senderOrganizationId(sender)! }
    : {}),
  ...(sender?.ownerModel === 'Space' ? { senderSpaceId: sender.ownerId } : {}),
});

const senderOrganizationId = (sender: Owner): string | null | undefined =>
  sender.ownerModel === 'Organization'
    ? sender.ownerId
    : sender.ownerModel === 'Space'
      ? sender.organizationId
      : null;

const clampedByKind = new WeakMap<RuleLens, Map<string, RuleLens>>();

const clampByKind = (slot: RuleLens, owner: EmailLensOwner, sender: EmailLensOwner): RuleLens => {
  const key = `${owner?.ownerModel ?? '-'}:${sender?.ownerModel ?? '-'}`;
  const byKind = clampedByKind.get(slot) ?? new Map<string, RuleLens>();
  clampedByKind.set(slot, byKind);
  const known = byKind.get(key);
  if (known) return known;
  const models = {
    ...platformDefaults,
    ...(owner ? EMAIL_OWNER_SCOPES[owner.ownerModel] : {}),
    ...(sender ? EMAIL_SENDER_SCOPES[sender.ownerModel] : {}),
  };
  const clamped: RuleLens = clampLens(slot, { mapDefaults: { prisma: { models } } });
  byKind.set(key, clamped);
  return clamped;
};

export const scopeEmailLens = (
  lens: EmailLens,
  owner: EmailLensOwner,
  sender: EmailLensOwner = owner,
): EmailLens => {
  const bindings = emailLensBindings(owner, sender);
  return narrowEmailLens(
    lens,
    (_root, slot) => bindLens(clampByKind(slot, owner, sender), bindings) as RuleLens,
  );
};
