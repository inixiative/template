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

const is = (field: string, value: string): Condition => ({
  field,
  operator: Operator.equals,
  value,
});

type Owner = NonNullable<EmailLensOwner>;

const organizationScope = (owner: Owner): Condition =>
  owner.ownerModel === 'Organization'
    ? is('id', owner.ownerId)
    : owner.organizationId
      ? is('id', owner.organizationId)
      : false;

const spaceScope = (owner: Owner): Condition =>
  owner.ownerModel === 'Space'
    ? is('id', owner.ownerId)
    : owner.ownerModel === 'Organization'
      ? is('organizationId', owner.ownerId)
      : false;

const ownerDefaults = (owner: Owner): NarrowingDefaults['models'] => ({
  Organization: {
    where: organizationScope(owner),
    sources: { id: { where: organizationScope(owner) } },
  },
  Space: { where: spaceScope(owner), sources: { id: { where: spaceScope(owner) } } },
});

const senderOrganization = (sender: Owner): Condition =>
  sender.ownerModel === 'Organization'
    ? is('organizationId', sender.ownerId)
    : sender.ownerModel === 'Space' && sender.organizationId
      ? is('organizationId', sender.organizationId)
      : false;

const membershipDefaults = (sender: Owner): NarrowingDefaults['models'] => ({
  OrganizationUser: { where: senderOrganization(sender) },
  SpaceUser: { where: senderOrganization(sender) },
});

export const scopeEmailLens = (
  lens: EmailLens,
  owner: EmailLensOwner,
  sender: EmailLensOwner = owner,
): EmailLens =>
  narrowEmailLens(lens, (_root, slot) => {
    const models = {
      ...platformDefaults,
      ...(owner ? ownerDefaults(owner) : {}),
      ...(sender ? membershipDefaults(sender) : {}),
    };
    const scoped: RuleLens = clampLens(slot, { mapDefaults: { prisma: { models } } });
    return owner
      ? (bindLens(scoped, polymorphicBindings(owner.ownerModel, owner.ownerId)) as RuleLens)
      : scoped;
  });
