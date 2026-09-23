/**
 * @atlas
 * @kind config
 * @partOf feature:customer
 * @uses infrastructure:prisma
 */
import {
  type Condition,
  type LensNarrowing,
  type ModelNarrowing,
  Operator,
  projectByPath,
  resolveLensBindings,
  ruleSourceValues,
  sourceQueries,
} from '@inixiative/json-rules';
import { db, polymorphicBindings, polymorphicIs } from '@template/db';
import type { Prisma, Segment } from '@template/db/generated/client/client';
import type { ProviderModel } from '@template/db/generated/client/enums';
import { boundAndLive, lensFor, live, omitForeignKeys, platformOrBound } from '@template/db/lens';

const tagOwned = platformOrBound('Tag', 'ownerModel');

const segmentOwned = boundAndLive('Segment', 'ownerModel');

const segmentNameable: Condition = {
  all: [segmentOwned, { field: 'featureFlagInternal', operator: Operator.equals, value: false }],
};

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
      polymorphicIs('CommunicationLog', 'senderType'),
    ],
  },
};

const customer = (picks: string[], relations: Record<string, ModelNarrowing> = {}): ModelNarrowing => ({
  picks,
  where: live,
  relations: { contacts, tagAttachments, ...relations },
});

export const customerRefLens: LensNarrowing = omitForeignKeys({
  parent: lensFor('CustomerRef'),
  mapDefaults: {
    prisma: {
      models: {
        Tag: { where: tagOwned },
        Segment: { where: segmentOwned, sources: { id: { label: 'name', where: segmentNameable } } },
      },
    },
  },
  root: {
    picks: ['id', 'customerModel', 'acceptedKinds', 'createdAt', 'updatedAt'],
    where: polymorphicIs('CustomerRef', 'providerModel'),
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

export const resolvedCustomerRefLens = (ownerModel: ProviderModel, ownerId: string): LensNarrowing =>
  resolveLensBindings(customerRefLens, polymorphicBindings(ownerModel, ownerId)) as LensNarrowing;

/** The segments the lens lets this owner name — its own live ones — read through the Segment source it declares. */
export const ownedSegments = async (
  ownerModel: ProviderModel,
  ownerId: string,
  where: Prisma.SegmentWhereInput = {},
): Promise<Segment[]> => {
  const source = sourceQueries(resolvedCustomerRefLens(ownerModel, ownerId)).find(
    (query) => query.model === 'Segment' && query.field === 'id',
  )!;
  return db.segment.findMany({ where: { AND: [source.prisma.where as Prisma.SegmentWhereInput, where] } });
};

export const customerRefReachedModels = (): Set<string> =>
  new Set([...projectByPath(customerRefLens).values()].map((visit) => visit.modelName));

const membershipProbe = {
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: '00000000-0000-7000-8000-000000000000' },
} as Condition;

if (
  !ruleSourceValues(customerRefLens, membershipProbe).some(
    (source) => source.model === 'Segment' && source.field === 'id' && !source.dynamic,
  )
) {
  throw new Error(
    'customerRefLens no longer reaches the Segment.id membership source; segment references would read every rule as reference-free',
  );
}
