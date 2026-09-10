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
import { ProviderModel } from '@template/db/generated/client/enums';
import { lensFor } from '@template/db/lens';
import { communicationSenderFk, customerRefProviderFk, segmentOwnerFk } from '#/modules/segment/lib/segmentOwner';

const SEGMENT_OWNER_BIND = 'ownerId';

const live: Condition = { field: 'deletedAt', operator: Operator.notExists };

const ownedBy = (fk: string): Condition => ({ field: fk, operator: Operator.equals, bind: SEGMENT_OWNER_BIND });

const contacts: ModelNarrowing = {
  picks: ['type', 'subtype', 'valueKey', 'deliverability', 'acceptedKinds', 'verifiedAt', 'createdAt'],
  where: live,
};

const tagAttachments = (ownerFk: string): ModelNarrowing => ({
  picks: [],
  where: live,
  relations: {
    tag: {
      picks: ['id', 'name'],
      where: live,
      sources: {
        id: {
          label: 'name',
          where: {
            all: [
              live,
              {
                any: [{ field: 'ownerModel', operator: Operator.equals, value: 'platform' }, ownedBy(ownerFk)],
              },
            ],
          },
        },
      },
    },
  },
});

const communicationsReceived = (ownerModel: ProviderModel): ModelNarrowing => ({
  picks: ['channel', 'kind', 'status', 'sentAt', 'createdAt'],
  where: {
    any: [
      { field: 'senderType', operator: Operator.in, value: ['platform', 'admin'] },
      ownedBy(communicationSenderFk(ownerModel)),
    ],
  },
});

const customer = (
  ownerFk: string,
  picks: string[],
  relations: Record<string, ModelNarrowing> = {},
): ModelNarrowing => ({
  picks,
  where: live,
  relations: { contacts, tagAttachments: tagAttachments(ownerFk), ...relations },
});

export const segmentLensFor = (ownerModel: ProviderModel): LensNarrowing => {
  const providerFk = customerRefProviderFk(ownerModel);
  const ownerFk = segmentOwnerFk(ownerModel);

  return {
    parent: lensFor('CustomerRef'),
    mapDefaults: {
      prisma: {
        models: {
          Segment: {
            sources: {
              id: { label: 'name', where: { all: [ownedBy(ownerFk), live] } },
            },
          },
        },
      },
    },
    root: {
      picks: ['id', 'customerModel', 'acceptedKinds', 'createdAt', 'updatedAt'],
      where: ownedBy(providerFk),
      relations: {
        customerUser: customer(ownerFk, ['id', 'name', 'email', 'emailVerified', 'lastLoginAt', 'createdAt'], {
          communicationsReceived: communicationsReceived(ownerModel),
        }),
        customerOrganization: customer(ownerFk, ['id', 'name', 'createdAt']),
        customerSpace: customer(ownerFk, ['id', 'name', 'createdAt']),
        segmentMembers: {
          picks: [],
          relations: {
            segment: { picks: ['id'], where: { all: [ownedBy(ownerFk), live] } },
          },
        },
      },
    },
  };
};

export const resolvedSegmentLens = (ownerModel: ProviderModel, ownerId: string): LensNarrowing =>
  resolveLensBindings(segmentLensFor(ownerModel), { [SEGMENT_OWNER_BIND]: ownerId }) as LensNarrowing;

export const segmentReachedModels = (): Set<string> => {
  const models = new Set<string>();
  for (const ownerModel of Object.values(ProviderModel)) {
    for (const visit of projectByPath(segmentLensFor(ownerModel)).values()) models.add(visit.modelName);
  }
  return models;
};

const membershipProbe = {
  field: 'segmentMembers',
  arrayOperator: 'any',
  condition: { field: 'segment.id', operator: Operator.equals, value: '00000000-0000-7000-8000-000000000000' },
} as Condition;

for (const ownerModel of Object.values(ProviderModel)) {
  const reachesMembershipSource = ruleSourceValues(segmentLensFor(ownerModel), membershipProbe).some(
    (source) => source.model === 'Segment' && source.field === 'id' && !source.dynamic,
  );
  if (!reachesMembershipSource) {
    throw new Error(
      `segmentLensFor(${ownerModel}) no longer reaches the Segment.id membership source; segment references would read every rule as reference-free`,
    );
  }
}
