import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { db, type Prisma } from '@template/db';
import type {
  CustomerRelationship,
  Organization,
  Segment,
  Space,
  User,
} from '@template/db/generated/client/client';
import {
  CommunicationKind,
  CommunicationLogSenderModel,
  ContactType,
  ProviderModel,
  SegmentType,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCommunicationLog,
  createContact,
  createCustomerRelationship,
  createOrganizationUser,
  createSegment,
  createSegmentMember,
  createSpace,
  createTag,
  createTagAttachment,
  createTagCategory,
  createUser,
  nextFactorySequenceNumber,
} from '@template/db/test';
import { emitAppEvent } from '#/appEvents/emit';
import { enqueueJob } from '#/jobs/enqueue';
import {
  applyMembershipDiff,
  PartialMembershipDiffError,
} from '#/modules/segment/services/applyMembershipDiff';
import { evaluateSegment } from '#/modules/segment/services/evaluateSegment';
import * as reconcileCustomerRelationshipsModule from '#/modules/segment/services/reconcileCustomerRelationships';
import {
  dynamicSegmentsOf,
  reconcileCustomerRelationships,
} from '#/modules/segment/services/reconcileCustomerRelationships';
import {
  acmeEmailDomainRule,
  segmentMemberCustomerRelationshipIds,
} from '#/modules/segment/tests/fixtures';

const idsRule = (ids: string[]) => ({ field: 'id', operator: Operator.in, value: ids });

type SegmentInput = Parameters<typeof createSegment>[0];
type SegmentDeps = Parameters<typeof createSegment>[1];

const saveSegment = async (data: SegmentInput, deps: SegmentDeps): Promise<Segment> => {
  const { entity } = await createSegment(data, deps);
  await emitAppEvent('segment.created', { segment: entity });
  return entity;
};

const updateSegment = async (
  previous: Segment,
  data: Prisma.SegmentUncheckedUpdateInput,
): Promise<Segment> => {
  const segment = await db.segment.update({ where: { id: previous.id }, data });
  await emitAppEvent('segment.updated', { segment, previous });
  return segment;
};

const setEmail = async (user: User, email: string): Promise<void> => {
  await db.user.update({ where: { id: user.id }, data: { email } });
  await enqueueJob('reconcileCustomerRelationshipSegments', {
    customers: [{ customerModel: 'User', customerId: user.id }],
  });
};

describe('segment reconcile', () => {
  let organization: Organization;
  let space: Space;
  let acme: User;
  let other: User;
  let acmeRelationship: CustomerRelationship;
  let otherRelationship: CustomerRelationship;

  const customerOf = async (user: User, provider: Space = space) =>
    (
      await createCustomerRelationship({
        customerModel: 'User',
        providerModel: 'Space',
        customerUserId: user.id,
        providerSpaceId: provider.id,
      })
    ).entity;

  beforeEach(async () => {
    const { context } = await createOrganizationUser({ role: 'admin' });
    organization = context.organization;
    space = (await createSpace({}, { organization })).entity;
    acme = (await createUser({ email: `acme-${nextFactorySequenceNumber()}@acme.test` })).entity;
    other = (await createUser({ email: `other-${nextFactorySequenceNumber()}@example.test` }))
      .entity;
    acmeRelationship = await customerOf(acme);
    otherRelationship = await customerOf(other);
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('a saved segment is not reconciled until its created event fires', async () => {
    const { entity: segment } = await createSegment(
      { ownerModel: 'Space', type: SegmentType.dynamic, conditions: acmeEmailDomainRule },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);

    await emitAppEvent('segment.created', { segment });
    expect(await evaluateSegment(segment)).toEqual([acmeRelationship.id]);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);
  });

  it('does not select customers of another provider', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const stranger = (
      await createUser({ email: `stranger-${nextFactorySequenceNumber()}@acme.test` })
    ).entity;
    await customerOf(stranger, elsewhere);

    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);
  });

  it('a rule that matches nobody admits nobody, not every customer of the owner', async () => {
    const segment = await saveSegment(
      { ownerModel: ProviderModel.Space, type: SegmentType.dynamic, conditions: { any: [] } },
      { space },
    );
    expect(await evaluateSegment(segment)).toEqual([]);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);
  });

  it('a tag rule sees platform tags and the owner’s own, never another owner’s, even by name', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const theirs = (
      await createTag(
        { name: 'vip', ownerModel: 'Space' },
        {
          space: elsewhere,
          tagCategory: (
            await createTagCategory({ ownerModel: 'Space' }, { space: elsewhere })
          ).entity,
        },
      )
    ).entity;
    await createTagAttachment({ resourceModel: 'User' }, { user: acme, tag: theirs });
    const byName = {
      field: 'customerUser.tagAttachments',
      arrayOperator: 'any',
      condition: { field: 'tag.name', operator: Operator.equals, value: 'vip' },
    };
    const segment = await saveSegment(
      { ownerModel: ProviderModel.Space, type: SegmentType.dynamic, conditions: byName },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);
    expect(await reconcileCustomerRelationships([acmeRelationship])).toEqual([]);

    const mine = (
      await createTag(
        { name: 'vip', ownerModel: 'Space' },
        {
          space,
          tagCategory: (await createTagCategory({ ownerModel: 'Space' }, { space })).entity,
        },
      )
    ).entity;
    const { entity: attachment } = await createTagAttachment(
      { resourceModel: 'User' },
      { user: acme, tag: mine },
    );
    await emitAppEvent('tagAttachment.created', { tagAttachment: attachment });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);
  });

  it('a static segment is computed when saved and holds until its conditions change', async () => {
    const picked = (
      await createUser({ email: `picked-${nextFactorySequenceNumber()}@example.test` })
    ).entity;
    const pickedRelationship = await customerOf(picked);
    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.static,
        conditions: { all: [acmeEmailDomainRule, idsRule([pickedRelationship.id])] },
      },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);

    await setEmail(picked, `picked-${nextFactorySequenceNumber()}@acme.test`);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);
    expect(await reconcileCustomerRelationships([pickedRelationship])).toEqual([]);

    const repicked = await updateSegment(segment, {
      conditions: idsRule([pickedRelationship.id, otherRelationship.id]),
    });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual(
      [pickedRelationship.id, otherRelationship.id].sort(),
    );

    await updateSegment(repicked, { name: `renamed-${nextFactorySequenceNumber()}` });
    await setEmail(picked, `picked-${nextFactorySequenceNumber()}@example.test`);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual(
      [pickedRelationship.id, otherRelationship.id].sort(),
    );
  });

  it('a hand-picked segment only admits the owner’s own customer relationships', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const foreignRelationship = await customerOf(other, elsewhere);
    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.static,
        conditions: idsRule([otherRelationship.id, foreignRelationship.id]),
      },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([otherRelationship.id]);

    await expect(
      createSegmentMember({}, { segment, customerRelationship: foreignRelationship }),
    ).rejects.toThrow('not a customer of the segment');
  });

  it('a user and an organization segment their own customers', async () => {
    const provider = (await createUser()).entity;
    const viaUser = (
      await createCustomerRelationship({
        customerModel: 'User',
        providerModel: ProviderModel.User,
        customerUserId: acme.id,
        providerUserId: provider.id,
      })
    ).entity;
    const viaOrganization = (
      await createCustomerRelationship({
        customerModel: 'User',
        providerModel: ProviderModel.Organization,
        customerUserId: acme.id,
        providerOrganizationId: organization.id,
      })
    ).entity;

    const mine = await saveSegment(
      {
        ownerModel: ProviderModel.User,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { user: provider },
    );
    expect(await segmentMemberCustomerRelationshipIds(mine.id)).toEqual([viaUser.id]);

    const ours = await saveSegment(
      {
        ownerModel: ProviderModel.Organization,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { organization },
    );
    expect(await segmentMemberCustomerRelationshipIds(ours.id)).toEqual([viaOrganization.id]);
  });

  it('a customer-side reconcile re-evaluates every reference of that customer, and only those', async () => {
    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { space },
    );
    const newcomer = (
      await createUser({ email: `late-${nextFactorySequenceNumber()}@example.test` })
    ).entity;
    const newcomerRelationship = await customerOf(newcomer);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);

    await setEmail(newcomer, `late-${nextFactorySequenceNumber()}@acme.test`);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual(
      [acmeRelationship.id, newcomerRelationship.id].sort(),
    );

    await setEmail(newcomer, `gone-${nextFactorySequenceNumber()}@example.test`);
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);
  });

  it('a contact event reaches the customer relationship through the contact owner', async () => {
    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: {
          field: 'customerUser.contacts',
          arrayOperator: 'any',
          condition: { field: 'type', operator: Operator.equals, value: ContactType.phone },
        },
      },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);

    const { entity: contact } = await createContact(
      {
        ownerModel: 'User',
        type: ContactType.phone,
        value: {
          e164: `+1555${String(nextFactorySequenceNumber()).padStart(7, '0').slice(-7)}`,
          country: 'US',
        },
      },
      { user: other },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);
    await emitAppEvent('contact.created', { contact });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([otherRelationship.id]);

    const deleted = await db.contact.update({
      where: { id: contact.id },
      data: { deletedAt: new Date() },
    });
    await emitAppEvent('contact.deleted', { contact: deleted });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);
  });

  it('a segment can be built from the membership of another, evaluated in dependency order', async () => {
    const base = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { space },
    );
    const derived = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: {
          all: [
            {
              field: 'segmentMembers',
              arrayOperator: 'any',
              condition: { field: 'segment.id', operator: Operator.equals, value: base.id },
            },
            { field: 'customerUser.emailVerified', operator: Operator.equals, value: true },
          ],
        },
      },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(derived.id)).toEqual([acmeRelationship.id]);

    const changes = await reconcileCustomerRelationships([acmeRelationship]);
    expect(changes).toEqual([]);

    await updateSegment(base, {
      conditions: {
        field: 'customerUser.email',
        operator: Operator.endsWith,
        value: '@nobody.test',
      },
    });
    expect(await segmentMemberCustomerRelationshipIds(base.id)).toEqual([]);
    expect(await segmentMemberCustomerRelationshipIds(derived.id)).toEqual([]);
  });

  it("a communication from another provider does not satisfy this provider's rule", async () => {
    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: {
          field: 'customerUser.communicationsReceived',
          arrayOperator: 'any',
          condition: {
            field: 'kind',
            operator: Operator.equals,
            value: CommunicationKind.marketing,
          },
        },
      },
      { space },
    );
    const elsewhere = (await createSpace({}, { organization })).entity;
    const foreign = await createCommunicationLog({
      kind: CommunicationKind.marketing,
      senderModel: CommunicationLogSenderModel.Space,
      recipientUserId: other.id,
      senderOrganizationId: organization.id,
      senderSpaceId: elsewhere.id,
    });
    await emitAppEvent('communication.outcomeRecorded', { communicationLog: foreign.entity });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);

    const ours = await createCommunicationLog({
      kind: CommunicationKind.marketing,
      senderModel: CommunicationLogSenderModel.Space,
      recipientUserId: other.id,
      senderOrganizationId: organization.id,
      senderSpaceId: space.id,
    });
    await emitAppEvent('communication.outcomeRecorded', { communicationLog: ours.entity });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([otherRelationship.id]);
  });

  it('a single customer write resolves a segment-of-segment in one pass', async () => {
    const base = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { space },
    );
    const derived = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: {
          field: 'segmentMembers',
          arrayOperator: 'any',
          condition: { field: 'segment.id', operator: Operator.equals, value: base.id },
        },
      },
      { space },
    );
    const newcomer = (
      await createUser({ email: `chain-${nextFactorySequenceNumber()}@example.test` })
    ).entity;
    const newcomerRelationship = await customerOf(newcomer);
    expect(await segmentMemberCustomerRelationshipIds(derived.id)).toEqual([acmeRelationship.id]);

    await setEmail(newcomer, `chain-${nextFactorySequenceNumber()}@acme.test`);
    expect(await segmentMemberCustomerRelationshipIds(base.id)).toEqual(
      [acmeRelationship.id, newcomerRelationship.id].sort(),
    );
    expect(await segmentMemberCustomerRelationshipIds(derived.id)).toEqual(
      [acmeRelationship.id, newcomerRelationship.id].sort(),
    );

    await setEmail(newcomer, `chain-${nextFactorySequenceNumber()}@example.test`);
    expect(await segmentMemberCustomerRelationshipIds(derived.id)).toEqual([acmeRelationship.id]);
  });

  it('flipping to static keeps the members and stops reacting; flipping back catches up', async () => {
    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);

    const frozen = await updateSegment(segment, { type: SegmentType.static });
    const newcomer = (
      await createUser({ email: `frozen-${nextFactorySequenceNumber()}@acme.test` })
    ).entity;
    const newcomerRelationship = await customerOf(newcomer);
    await enqueueJob('reconcileCustomerRelationshipSegments', {
      customers: [{ customerModel: 'User', customerId: newcomer.id }],
    });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);

    await updateSegment(frozen, { type: SegmentType.dynamic });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual(
      [acmeRelationship.id, newcomerRelationship.id].sort(),
    );
  });

  it("the owner's dynamic segments are its owned segments filtered to dynamic", async () => {
    const rule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };
    const { entity: live } = await createSegment(
      { ownerModel: ProviderModel.Space, type: SegmentType.dynamic, conditions: rule },
      { space },
    );
    const { entity: frozen } = await createSegment(
      { ownerModel: ProviderModel.Space, type: SegmentType.static, conditions: rule },
      { space },
    );
    const ids = (await dynamicSegmentsOf(ProviderModel.Space, space.id)).map(({ id }) => id);
    expect(ids).toContain(live.id);
    expect(ids).not.toContain(frozen.id);
  });
  it('one job over several customers reconciles each of them, adding and removing together', async () => {
    const segment = await saveSegment(
      {
        ownerModel: ProviderModel.Space,
        type: SegmentType.dynamic,
        conditions: acmeEmailDomainRule,
      },
      { space },
    );
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([acmeRelationship.id]);

    await db.user.update({
      where: { id: acme.id },
      data: { email: `left-${nextFactorySequenceNumber()}@example.test` },
    });
    await db.user.update({
      where: { id: other.id },
      data: { email: `joined-${nextFactorySequenceNumber()}@acme.test` },
    });
    await enqueueJob('reconcileCustomerRelationshipSegments', {
      customers: [
        { customerModel: 'User', customerId: acme.id },
        { customerModel: 'User', customerId: other.id },
      ],
    });

    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([otherRelationship.id]);
  });

  it('deleting a tag on several customers reconciles them in one job', async () => {
    const tagCategory = (await createTagCategory({ ownerModel: 'Space' }, { space })).entity;
    const tag = (await createTag({ name: 'vip', ownerModel: 'Space' }, { space, tagCategory }))
      .entity;
    const tagAttachments = [
      (await createTagAttachment({ resourceModel: 'User' }, { user: acme, tag })).entity,
      (await createTagAttachment({ resourceModel: 'User' }, { user: other, tag })).entity,
    ];
    const reconciled = spyOn(
      reconcileCustomerRelationshipsModule,
      'reconcileCustomerRelationships',
    );

    await emitAppEvent('tag.deleted', { tag, tagAttachments });

    expect(reconciled).toHaveBeenCalledTimes(1);
    expect(reconciled.mock.calls[0]?.[0].map(({ id }) => id).sort()).toEqual(
      [acmeRelationship.id, otherRelationship.id].sort(),
    );
    reconciled.mockRestore();
  });

  it('segmentMemberOwner hook validates createManyAndReturn batches and rejects mismatched owners', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const outsider = (
      await createUser({ email: `outsider-${nextFactorySequenceNumber()}@example.test` })
    ).entity;
    const outsiderRelationship = await customerOf(outsider, elsewhere);
    const { entity: segment } = await createSegment(
      { ownerModel: ProviderModel.Space, type: SegmentType.static },
      { space },
    );

    await db.segmentMember.createManyAndReturn({
      data: [
        { segmentId: segment.id, customerRelationshipId: acmeRelationship.id },
        { segmentId: segment.id, customerRelationshipId: otherRelationship.id },
      ],
    });
    expect((await segmentMemberCustomerRelationshipIds(segment.id)).sort()).toEqual(
      [acmeRelationship.id, otherRelationship.id].sort(),
    );

    await expect(
      db.segmentMember.createManyAndReturn({
        data: [{ segmentId: segment.id, customerRelationshipId: outsiderRelationship.id }],
      }),
    ).rejects.toThrow(/is not a customer of the segment's Space/);
  });

  it('full applyMembershipDiff runs chunked writes via db.parallel and reports committed changes on partial failure', async () => {
    const { entity: segment } = await createSegment(
      { ownerModel: ProviderModel.Space, type: SegmentType.static },
      { space },
    );
    await createSegmentMember({}, { segment, customerRelationship: acmeRelationship });

    const diff = await applyMembershipDiff({
      segmentId: segment.id,
      matching: [otherRelationship.id],
    });
    expect(diff).toEqual({ added: [otherRelationship.id], removed: [acmeRelationship.id] });
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([otherRelationship.id]);

    const elsewhere = (await createSpace({}, { organization })).entity;
    const outsider = (
      await createUser({ email: `partial-outsider-${nextFactorySequenceNumber()}@example.test` })
    ).entity;
    const outsiderRelationship = await customerOf(outsider, elsewhere);

    let caught: unknown;
    try {
      await applyMembershipDiff({
        segmentId: segment.id,
        matching: [outsiderRelationship.id],
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PartialMembershipDiffError);
    const partial = caught as PartialMembershipDiffError;
    expect(partial.committed).toEqual({
      added: [],
      removed: [otherRelationship.id],
    });
    expect(String(partial.cause)).toContain("is not a customer of the segment's Space");
    expect(await segmentMemberCustomerRelationshipIds(segment.id)).toEqual([]);
  });
});
