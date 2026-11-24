/**
 * @atlas
 * @kind config
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import {
  type Condition,
  describeRuleSources,
  type LensNarrowing,
  type ModelNarrowing,
  Operator,
} from '@inixiative/json-rules';
import { conditionPolymorphicAxisPointsAtBoundRow } from '@template/db';
import {
  lensFor,
  omitForeignKeys,
  platformOrPointsAtBoundRow,
  pointsAtBoundRowAndIsNotDeleted,
} from '@template/db/lens';
import { notDeleted } from '@template/shared/rules';

const tagOwned = platformOrPointsAtBoundRow('Tag', 'ownerModel');

const segmentOwned = pointsAtBoundRowAndIsNotDeleted('Segment', 'ownerModel');

const contacts: ModelNarrowing = {
  picks: [
    'type',
    'subtype',
    'valueKey',
    'deliverability',
    'acceptedKinds',
    'verifiedAt',
    'createdAt',
  ],
  where: notDeleted,
};

const tagAttachments: ModelNarrowing = {
  picks: [],
  where: notDeleted,
  relations: {
    tag: { picks: ['id', 'name'], sources: { id: { from: 'mapDefaults' } } },
  },
};

const communicationsReceived: ModelNarrowing = {
  picks: ['channel', 'kind', 'status', 'sentAt', 'createdAt'],
  where: {
    any: [
      { field: 'senderModel', operator: Operator.in, value: ['platform', 'admin'] },
      conditionPolymorphicAxisPointsAtBoundRow('CommunicationLog', 'senderModel'),
    ],
  },
};

export const customerRelationshipLens: LensNarrowing = omitForeignKeys({
  parent: lensFor('CustomerRelationship'),
  mapDefaults: {
    prisma: {
      models: {
        Tag: { where: tagOwned, sources: { id: { label: 'name', where: tagOwned } } },
        Segment: { where: segmentOwned, sources: { id: { label: 'name', where: segmentOwned } } },
      },
    },
  },
  root: {
    picks: ['id', 'customerModel', 'acceptedKinds', 'createdAt', 'updatedAt'],
    where: conditionPolymorphicAxisPointsAtBoundRow('CustomerRelationship', 'providerModel'),
    relations: {
      customerUser: {
        picks: ['id', 'name', 'email', 'emailVerified', 'lastLoginAt', 'createdAt'],
        where: notDeleted,
        relations: { contacts, tagAttachments, communicationsReceived },
      },
      customerOrganization: {
        picks: ['id', 'name', 'createdAt'],
        where: notDeleted,
        relations: { contacts, tagAttachments },
      },
      customerSpace: {
        picks: ['id', 'name', 'createdAt'],
        where: notDeleted,
        relations: { contacts, tagAttachments },
      },
      segmentMembers: {
        picks: [],
        relations: { segment: { picks: ['id'], sources: { id: { from: 'mapDefaults' } } } },
      },
    },
  },
});

const membershipProbe = {
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: {
    field: 'segment.id',
    operator: Operator.equals,
    value: '00000000-0000-7000-8000-000000000000',
  },
} as Condition;

if (
  !describeRuleSources(membershipProbe, customerRelationshipLens).some(
    (source) => source.model === 'Segment' && source.field === 'id' && !source.dynamic,
  )
) {
  throw new Error(
    'customerRelationshipLens no longer reaches the Segment.id membership source; segment references would read every rule as reference-free',
  );
}
