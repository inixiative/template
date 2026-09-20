/**
 * @atlas
 * @kind config
 * @partOf feature:segment
 * @uses feature:customer, infrastructure:prisma
 */
import {
  type Condition,
  type LensNarrowing,
  type ModelNarrowing,
  Operator,
  projectByPath,
  resolveLensBindings,
  ruleSourceValues,
} from '@inixiative/json-rules';
import { ownedBy, ownerBindings } from '@template/db';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { lensFor, omitForeignKeys } from '@template/db/lens';

const live: Condition = { field: 'deletedAt', operator: Operator.notExists };

const tagOwned: Condition = {
  all: [
    live,
    { any: [{ field: 'ownerModel', operator: Operator.equals, value: 'platform' }, ownedBy('Tag', 'ownerModel')] },
  ],
};

const segmentOwned: Condition = { all: [ownedBy('Segment', 'ownerModel'), live] };

const contacts: ModelNarrowing = {
  picks: ['type', 'subtype', 'valueKey', 'deliverability', 'acceptedKinds', 'verifiedAt', 'createdAt'],
  where: live,
};

const tagAttachments: ModelNarrowing = {
  picks: [],
  where: live,
  relations: { tag: { picks: ['id', 'name'], where: live, sources: { id: { label: 'name', where: tagOwned } } } },
};

const communicationsReceived: ModelNarrowing = {
  picks: ['channel', 'kind', 'status', 'sentAt', 'createdAt'],
  where: {
    any: [
      { field: 'senderType', operator: Operator.in, value: ['platform', 'admin'] },
      ownedBy('CommunicationLog', 'senderType'),
    ],
  },
};

const customer = (picks: string[], relations: Record<string, ModelNarrowing> = {}): ModelNarrowing => ({
  picks,
  where: live,
  relations: { contacts, tagAttachments, ...relations },
});

export const segmentLens: LensNarrowing = omitForeignKeys({
  parent: lensFor('CustomerRef'),
  mapDefaults: {
    prisma: {
      models: {
        Tag: { where: tagOwned },
        Segment: { where: segmentOwned, sources: { id: { label: 'name', where: segmentOwned } } },
      },
    },
  },
  root: {
    picks: ['id', 'customerModel', 'acceptedKinds', 'createdAt', 'updatedAt'],
    where: ownedBy('CustomerRef', 'providerModel'),
    relations: {
      customerUser: customer(['id', 'name', 'email', 'emailVerified', 'lastLoginAt', 'createdAt'], {
        communicationsReceived,
      }),
      customerOrganization: customer(['id', 'name', 'createdAt']),
      customerSpace: customer(['id', 'name', 'createdAt']),
      segmentMembers: { picks: [], relations: { segment: { picks: ['id'], where: segmentOwned } } },
    },
  },
});

export const resolvedSegmentLens = (ownerModel: ProviderModel, ownerId: string): LensNarrowing =>
  resolveLensBindings(segmentLens, ownerBindings(ownerModel, ownerId)) as LensNarrowing;

export const segmentReachedModels = (): Set<string> =>
  new Set([...projectByPath(segmentLens).values()].map((visit) => visit.modelName));

const membershipProbe = {
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: '00000000-0000-7000-8000-000000000000' },
} as Condition;

if (
  !ruleSourceValues(segmentLens, membershipProbe).some(
    (source) => source.model === 'Segment' && source.field === 'id' && !source.dynamic,
  )
) {
  throw new Error(
    'segmentLens no longer reaches the Segment.id membership source; segment references would read every rule as reference-free',
  );
}
