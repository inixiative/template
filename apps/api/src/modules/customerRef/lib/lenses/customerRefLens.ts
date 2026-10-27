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
import { polymorphicIs } from '@template/db';
import { boundAndLive, lensFor, live, omitForeignKeys, platformOrBound } from '@template/db/lens';

const tagOwned = platformOrBound('Tag', 'ownerModel');

const segmentOwned = boundAndLive('Segment', 'ownerModel');

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
  where: live,
};

const tagAttachments: ModelNarrowing = {
  picks: [],
  where: live,
  relations: {
    tag: { picks: ['id', 'name'], sources: { id: { from: 'mapDefaults' } } },
  },
};

const communicationsReceived: ModelNarrowing = {
  picks: ['channel', 'kind', 'status', 'sentAt', 'createdAt'],
  where: {
    any: [
      { field: 'senderType', operator: Operator.in, value: ['platform', 'admin'] },
      polymorphicIs('CommunicationLog', 'senderType'),
    ],
  },
};

export const customerRefLens: LensNarrowing = omitForeignKeys({
  parent: lensFor('CustomerRef'),
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
    where: polymorphicIs('CustomerRef', 'providerModel'),
    relations: {
      customerUser: {
        picks: ['id', 'name', 'email', 'emailVerified', 'lastLoginAt', 'createdAt'],
        where: live,
        relations: { contacts, tagAttachments, communicationsReceived },
      },
      customerOrganization: {
        picks: ['id', 'name', 'createdAt'],
        where: live,
        relations: { contacts, tagAttachments },
      },
      customerSpace: {
        picks: ['id', 'name', 'createdAt'],
        where: live,
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
  !describeRuleSources(membershipProbe, customerRefLens).some(
    (source) => source.model === 'Segment' && source.field === 'id' && !source.dynamic,
  )
) {
  throw new Error(
    'customerRefLens no longer reaches the Segment.id membership source; segment references would read every rule as reference-free',
  );
}
