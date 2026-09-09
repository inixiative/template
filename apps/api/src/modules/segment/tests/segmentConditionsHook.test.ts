import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type { Space, User } from '@template/db/generated/client/client';
import { SegmentOwnerModel, SegmentType } from '@template/db/generated/client/enums';
import { cleanupTouchedTables, createOrganizationUser, createSegment, createSpace } from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };

describe('segmentConditions hook', () => {
  let space: Space;
  let user: User;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    const { context } = await createOrganizationUser({ role: 'admin' });
    user = context.user;
    space = (await createSpace({}, { organization: context.organization })).entity;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('refuses a dynamic segment without conditions', async () => {
    await expect(createSegment({ type: SegmentType.dynamic }, { space })).rejects.toThrow('requires conditions');
  });

  it('refuses a static segment that carries conditions', async () => {
    await expect(createSegment({ type: SegmentType.static, conditions: acmeRule }, { space })).rejects.toThrow(
      'carries no conditions',
    );
  });

  it('refuses conditions outside the segment lens vocabulary', async () => {
    await expect(
      createSegment(
        {
          type: SegmentType.dynamic,
          conditions: { field: 'customerUser.platformRole', operator: Operator.equals, value: 'user' },
        },
        { space },
      ),
    ).rejects.toThrow('Invalid segment conditions');
  });

  it('accepts a valid rule and writes the normalized tree back', async () => {
    const { entity } = await createSegment(
      {
        type: SegmentType.dynamic,
        conditions: { all: [acmeRule, { field: 'customerUser.contacts', arrayOperator: 'any' }] },
      },
      { space },
    );
    expect(entity.conditions).toEqual({
      all: [acmeRule, { field: 'customerUser.contacts', arrayOperator: 'any', condition: { all: [] } }],
    });
  });

  it('refuses an empty arm inside any', async () => {
    await expect(
      createSegment({ type: SegmentType.dynamic, conditions: { any: [acmeRule, { all: [] }] } }, { space }),
    ).rejects.toThrow('matches every customer');
  });

  it('refuses a segment that references its own membership', async () => {
    const { entity } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
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

  it('refuses a membership rule that reads the segment from a path', async () => {
    await expect(
      createSegment(
        {
          type: SegmentType.dynamic,
          conditions: {
            field: 'segmentMembers',
            arrayOperator: 'any',
            condition: { field: 'segment.id', operator: Operator.equals, path: 'customerUser.id' },
          },
        },
        { space },
      ),
    ).rejects.toThrow('must name the segment');
  });

  it('refuses a rule naming a segment that does not exist or belongs to another owner', async () => {
    const membersOf = (id: string) => ({
      field: 'segmentMembers',
      arrayOperator: 'any',
      condition: { field: 'segment.id', operator: Operator.equals, value: id },
    });
    await expect(
      createSegment(
        { type: SegmentType.dynamic, conditions: membersOf('00000000-0000-7000-8000-00000000dead') },
        { space },
      ),
    ).rejects.toThrow('does not own');

    const { context } = await createOrganizationUser();
    const elsewhere = (await createSpace({}, { organization: context.organization })).entity;
    const { entity: foreign } = await createSegment(
      { type: SegmentType.dynamic, conditions: acmeRule },
      { space: elsewhere },
    );
    await expect(
      createSegment({ type: SegmentType.dynamic, conditions: membersOf(foreign.id) }, { space }),
    ).rejects.toThrow('does not own');

    const { entity: own } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity } = await createSegment({ type: SegmentType.dynamic, conditions: membersOf(own.id) }, { space });
    expect(entity.id).toBeTruthy();
  });

  it('refuses a dynamic segment for an owner that has no customer references yet', async () => {
    await expect(
      createSegment({ ownerModel: SegmentOwnerModel.User, type: SegmentType.dynamic, conditions: acmeRule }, { user }),
    ).rejects.toThrow('no provider branch for User');
  });

  it('validates on update when only the type flips to dynamic', async () => {
    const { entity } = await createSegment({ type: SegmentType.static }, { space });
    await expect(db.segment.update({ where: { id: entity.id }, data: { type: SegmentType.dynamic } })).rejects.toThrow(
      'requires conditions',
    );
    const updated = await db.segment.update({
      where: { id: entity.id },
      data: { type: SegmentType.dynamic, conditions: acmeRule },
    });
    expect(updated.conditions).toEqual(acmeRule);
  });
});
