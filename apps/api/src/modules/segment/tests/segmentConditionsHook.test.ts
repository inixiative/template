import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db, Prisma } from '@template/db';
import type { Organization, Space, User } from '@template/db/generated/client/client';
import { ProviderModel, SegmentType } from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createFeatureFlag,
  createFeatureFlagVariant,
  createOrganizationUser,
  createSegment,
  createSpace,
} from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

describe('segmentConditions hook', () => {
  let space: Space;
  let organization: Organization;
  let user: User;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    user = context.user;
    organization = context.organization;
    space = (await createSpace({}, { organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('refuses a segment without conditions, whatever its type', async () => {
    for (const type of [SegmentType.static, SegmentType.dynamic]) {
      await expect(createSegment({ type, conditions: Prisma.DbNull as never }, { space })).rejects.toThrow(
        'requires conditions',
      );
    }
  });

  it('refuses conditions outside the segment lens vocabulary', async () => {
    await expect(
      createSegment(
        { conditions: { field: 'customerUser.platformRole', operator: Operator.equals, value: 'user' } },
        { space },
      ),
    ).rejects.toThrow('Invalid segment conditions');
  });

  it('a platform segment may name only platform segments', async () => {
    const { entity: theirs } = await createSegment({ conditions: acmeRule }, { space });
    const naming = (id: string) => ({
      field: 'segmentMembers',
      arrayOperator: 'any',
      condition: { field: 'segment.id', operator: Operator.equals, value: id },
    });
    await expect(
      createSegment({ ownerModel: ProviderModel.platform, conditions: naming(theirs.id) }, {}),
    ).rejects.toThrow('this platform does not own');

    const { entity: ours } = await createSegment({ ownerModel: ProviderModel.platform, conditions: acmeRule }, {});
    const { entity } = await createSegment({ ownerModel: ProviderModel.platform, conditions: naming(ours.id) }, {});
    expect(entity.ownerModel).toBe('platform');
  });

  it('a rule may not name an internal segment, even the owner’s own', async () => {
    const { entity: flag } = await createFeatureFlag({ slug: 'custom:x', ownerModel: ProviderModel.Space, space });
    const { entity: audience } = await createSegment({ conditions: acmeRule }, { space });
    const { entity: variant } = await createFeatureFlagVariant({ segment: audience }, { featureFlag: flag });
    const { entity: internal } = await createSegment(
      { conditions: acmeRule, featureFlagVariantId: variant.id },
      { space },
    );
    const naming = {
      field: 'segmentMembers',
      arrayOperator: 'any',
      condition: { field: 'segment.id', operator: Operator.equals, value: internal.id },
    };
    await expect(createSegment({ conditions: naming }, { space })).rejects.toThrow('does not own');
  });

  it('accepts a valid rule and writes the normalized tree back', async () => {
    const { entity } = await createSegment(
      { conditions: { all: [acmeRule, { field: 'customerUser.contacts', arrayOperator: 'any' }] } },
      { space },
    );
    expect(entity.conditions).toEqual({
      all: [acmeRule, { field: 'customerUser.contacts', arrayOperator: 'any', condition: { all: [] } }],
    });
  });

  it('refuses an empty arm inside any', async () => {
    await expect(createSegment({ conditions: { any: [acmeRule, { all: [] }] } }, { space })).rejects.toThrow(
      'matches every row',
    );
  });

  it('refuses a segment that references its own membership', async () => {
    const { entity } = await createSegment({ conditions: acmeRule }, { space });
    await expect(
      db.segment.update({
        where: { id: entity.id },
        data: {
          conditions: {
            field: 'segmentMembers',
            arrayOperator: 'any',
            condition: { field: 'segment.id', operator: Operator.equals, value: entity.id },
          },
        },
      }),
    ).rejects.toThrow('reference its own membership');
  });

  it('refuses a rule that reads its value from a path: the set rail cannot compile a column-to-column compare', async () => {
    await expect(
      createSegment(
        {
          conditions: {
            field: 'segmentMembers',
            arrayOperator: 'any',
            condition: { field: 'segment.id', operator: Operator.equals, path: 'customerUser.id' },
          },
        },
        { space },
      ),
    ).rejects.toThrow('Invalid segment conditions');
  });

  it('refuses a rule naming a segment that does not exist or belongs to another owner', async () => {
    const membersOf = (id: string) => ({
      field: 'segmentMembers',
      arrayOperator: 'any',
      condition: { field: 'segment.id', operator: Operator.equals, value: id },
    });
    await expect(
      createSegment({ conditions: membersOf('00000000-0000-7000-8000-00000000dead') }, { space }),
    ).rejects.toThrow('does not own');

    const { context } = await createOrganizationUser();
    const elsewhere = (await createSpace({}, { organization: context.organization })).entity;
    const { entity: foreign } = await createSegment({ conditions: acmeRule }, { space: elsewhere });
    await expect(createSegment({ conditions: membersOf(foreign.id) }, { space })).rejects.toThrow('does not own');

    const { entity: own } = await createSegment({ conditions: acmeRule }, { space });
    const { entity } = await createSegment({ conditions: membersOf(own.id) }, { space });
    expect(entity.id).toBeTruthy();
  });

  it('validates a user-owned and an organization-owned segment against their own customer lens', async () => {
    const mine = await createSegment({ ownerModel: ProviderModel.User, conditions: acmeRule }, { user });
    expect(mine.entity.userId).toBe(user.id);
    const ours = await createSegment(
      { ownerModel: ProviderModel.Organization, conditions: acmeRule },
      { organization },
    );
    expect(ours.entity.organizationId).toBe(organization.id);
  });

  it('refuses clearing conditions on update and leaves an untouched rule alone', async () => {
    const { entity } = await createSegment({ conditions: acmeRule }, { space });
    await expect(
      db.segment.update({ where: { id: entity.id }, data: { conditions: Prisma.DbNull as never } }),
    ).rejects.toThrow('requires conditions');
    const renamed = await db.segment.update({ where: { id: entity.id }, data: { type: SegmentType.dynamic } });
    expect(renamed.conditions).toEqual(acmeRule);
  });
});
