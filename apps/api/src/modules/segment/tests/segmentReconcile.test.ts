import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { Operator } from '@inixiative/json-rules';
import { clearHookRegistry, db } from '@template/db';
import type { CustomerRef, Organization, Space, User } from '@template/db/generated/client/client';
import {
  CommunicationKind,
  ContactType,
  ProviderModel,
  SegmentReconcilePauseReason,
  SegmentType,
  SenderType,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createCommunicationLog,
  createContact,
  createCustomerRef,
  createOrganizationUser,
  createSegment,
  createSegmentMember,
  createSpace,
  createUser,
  getNextSeq,
} from '@template/db/test';
import { registerSegmentConditionsHook } from '#/hooks/segmentConditions/hook';
import { registerSegmentMemberOwnerHook } from '#/hooks/segmentMemberOwner/hook';
import { registerSegmentReconcileHook } from '#/hooks/segmentReconcile/hook';
import { evaluateSegment } from '#/modules/segment/services/evaluateSegment';
import { reconcileCustomerRef } from '#/modules/segment/services/reconcileCustomerRef';

const acmeRule = { field: 'customerUser.email', operator: Operator.endsWith, value: '@acme.test' };
const idsRule = (ids: string[]) => ({ field: 'id', operator: Operator.in, value: ids });

const memberIds = async (segmentId: string): Promise<string[]> =>
  (await db.segmentMember.findMany({ where: { segmentId } })).map((member) => member.customerRefId).sort();

describe('segment reconcile', () => {
  let organization: Organization;
  let space: Space;
  let acme: User;
  let other: User;
  let acmeRef: CustomerRef;
  let otherRef: CustomerRef;

  const customerOf = async (user: User, provider: Space = space) =>
    (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Space',
        customerUser: user,
        providerSpace: provider,
      })
    ).entity;

  beforeAll(async () => {
    registerSegmentConditionsHook();
    registerSegmentMemberOwnerHook();
    registerSegmentReconcileHook();

    const { context } = await createOrganizationUser({ role: 'admin' });
    organization = context.organization;
    space = (await createSpace({}, { organization })).entity;
    acme = (await createUser({ email: `acme-${getNextSeq()}@acme.test` })).entity;
    other = (await createUser({ email: `other-${getNextSeq()}@example.test` })).entity;
    acmeRef = await customerOf(acme);
    otherRef = await customerOf(other);
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
    clearHookRegistry();
  });

  it('creating a dynamic segment reconciles its membership set-wise', async () => {
    const { entity: segment } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });

    expect(await evaluateSegment(segment)).toEqual([acmeRef.id]);
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);
  });

  it('does not select customers of another provider', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const stranger = (await createUser({ email: `stranger-${getNextSeq()}@acme.test` })).entity;
    await customerOf(stranger, elsewhere);

    const { entity: segment } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);
  });

  it('a static segment is computed when saved and holds until its conditions change', async () => {
    const picked = (await createUser({ email: `picked-${getNextSeq()}@example.test` })).entity;
    const pickedRef = await customerOf(picked);
    const { entity: segment } = await createSegment(
      { type: SegmentType.static, conditions: { all: [acmeRule, idsRule([pickedRef.id])] } },
      { space },
    );
    expect(await memberIds(segment.id)).toEqual([]);

    await db.user.update({ where: { id: picked.id }, data: { email: `picked-${getNextSeq()}@acme.test` } });
    expect(await memberIds(segment.id)).toEqual([]);
    expect(await reconcileCustomerRef(pickedRef.id)).toEqual([]);

    await db.segment.update({ where: { id: segment.id }, data: { conditions: idsRule([pickedRef.id, otherRef.id]) } });
    expect(await memberIds(segment.id)).toEqual([pickedRef.id, otherRef.id].sort());

    await db.user.update({ where: { id: picked.id }, data: { email: `picked-${getNextSeq()}@example.test` } });
    expect(await memberIds(segment.id)).toEqual([pickedRef.id, otherRef.id].sort());
  });

  it('a hand-picked segment only admits the owner’s own customer references', async () => {
    const elsewhere = (await createSpace({}, { organization })).entity;
    const foreignRef = await customerOf(other, elsewhere);
    const { entity: segment } = await createSegment(
      { type: SegmentType.static, conditions: idsRule([otherRef.id, foreignRef.id]) },
      { space },
    );
    expect(await memberIds(segment.id)).toEqual([otherRef.id]);

    await expect(createSegmentMember({}, { segment, customerRef: foreignRef })).rejects.toThrow(
      'not a customer of the segment',
    );
  });

  it('a user and an organization segment their own customers', async () => {
    const provider = (await createUser()).entity;
    const viaUser = (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: ProviderModel.User,
        customerUser: acme,
        providerUser: provider,
      })
    ).entity;
    const viaOrganization = (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: ProviderModel.Organization,
        customerUser: acme,
        providerOrganization: organization,
      })
    ).entity;

    const mine = await createSegment(
      { ownerModel: ProviderModel.User, type: SegmentType.dynamic, conditions: acmeRule },
      { user: provider },
    );
    expect(await memberIds(mine.entity.id)).toEqual([viaUser.id]);

    const ours = await createSegment(
      { ownerModel: ProviderModel.Organization, type: SegmentType.dynamic, conditions: acmeRule },
      { organization },
    );
    expect(await memberIds(ours.entity.id)).toEqual([viaOrganization.id]);
  });

  it('a write to the customer user re-evaluates that customer reference only', async () => {
    const { entity: segment } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const newcomer = (await createUser({ email: `late-${getNextSeq()}@example.test` })).entity;
    const newcomerRef = await customerOf(newcomer);
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);

    await db.user.update({ where: { id: newcomer.id }, data: { email: `late-${getNextSeq()}@acme.test` } });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id, newcomerRef.id].sort());

    await db.user.update({ where: { id: newcomer.id }, data: { email: `gone-${getNextSeq()}@example.test` } });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);
  });

  it('a write to a related row (contact) reaches the customer reference through the owner', async () => {
    const { entity: segment } = await createSegment(
      {
        type: SegmentType.dynamic,
        conditions: {
          field: 'customerUser.contacts',
          arrayOperator: 'any',
          condition: { field: 'type', operator: Operator.equals, value: ContactType.phone },
        },
      },
      { space },
    );
    expect(await memberIds(segment.id)).toEqual([]);

    const { entity: contact } = await createContact(
      {
        type: ContactType.phone,
        value: { e164: `+1555${String(getNextSeq()).padStart(7, '0').slice(-7)}`, country: 'US' },
      },
      { user: other },
    );
    expect(await memberIds(segment.id)).toEqual([otherRef.id]);

    await db.contact.delete({ where: { id: contact.id } });
    expect(await memberIds(segment.id)).toEqual([]);
  });

  it('a segment can be built from the membership of another, evaluated in dependency order', async () => {
    const { entity: base } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity: derived } = await createSegment(
      {
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
    expect(await memberIds(derived.id)).toEqual([acmeRef.id]);

    const changes = await reconcileCustomerRef(acmeRef.id);
    expect(changes).toEqual([]);

    await db.segment.update({
      where: { id: base.id },
      data: { conditions: { field: 'customerUser.email', operator: Operator.endsWith, value: '@nobody.test' } },
    });
    expect(await memberIds(base.id)).toEqual([]);
    expect(await memberIds(derived.id)).toEqual([]);
  });

  it("a communication from another provider does not satisfy this provider's rule", async () => {
    const { entity: segment } = await createSegment(
      {
        type: SegmentType.dynamic,
        conditions: {
          field: 'customerUser.communicationsReceived',
          arrayOperator: 'any',
          condition: { field: 'kind', operator: Operator.equals, value: CommunicationKind.marketing },
        },
      },
      { space },
    );
    const elsewhere = (await createSpace({}, { organization })).entity;
    await createCommunicationLog({
      kind: CommunicationKind.marketing,
      senderType: SenderType.Space,
      recipientUser: other,
      senderSpace: elsewhere,
    });
    expect(await memberIds(segment.id)).toEqual([]);

    await createCommunicationLog({
      kind: CommunicationKind.marketing,
      senderType: SenderType.Space,
      recipientUser: other,
      senderSpace: space,
    });
    expect(await memberIds(segment.id)).toEqual([otherRef.id]);
  });

  it('a single customer write resolves a segment-of-segment in one pass', async () => {
    const { entity: base } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    const { entity: derived } = await createSegment(
      {
        type: SegmentType.dynamic,
        conditions: {
          field: 'segmentMembers',
          arrayOperator: 'any',
          condition: { field: 'segment.id', operator: Operator.equals, value: base.id },
        },
      },
      { space },
    );
    const newcomer = (await createUser({ email: `chain-${getNextSeq()}@example.test` })).entity;
    const newcomerRef = await customerOf(newcomer);
    expect(await memberIds(derived.id)).toEqual([acmeRef.id]);

    await db.user.update({ where: { id: newcomer.id }, data: { email: `chain-${getNextSeq()}@acme.test` } });
    expect(await memberIds(base.id)).toEqual([acmeRef.id, newcomerRef.id].sort());
    expect(await memberIds(derived.id)).toEqual([acmeRef.id, newcomerRef.id].sort());

    await db.user.update({ where: { id: newcomer.id }, data: { email: `chain-${getNextSeq()}@example.test` } });
    expect(await memberIds(derived.id)).toEqual([acmeRef.id]);
  });

  it('an evaluation-error pause is retried and cleared by the next reconcile', async () => {
    const { entity: segment } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    await db.segment.update({
      where: { id: segment.id },
      data: {
        reconcilePausedAt: new Date(),
        reconcilePausedReason: SegmentReconcilePauseReason.evaluationError,
        reconcilePausedDetail: 'boom',
      },
    });
    const updated = await db.segment.update({
      where: { id: segment.id },
      data: { conditions: { field: 'customerUser.email', operator: Operator.equals, value: other.email } },
    });
    expect(updated.reconcilePausedReason).toBe(SegmentReconcilePauseReason.evaluationError);
    expect(await memberIds(segment.id)).toEqual([otherRef.id]);
    const after = await db.segment.findUnique({ where: { id: segment.id } });
    expect(after!.reconcilePausedAt).toBeNull();
  });

  it('flipping to static keeps the members and stops reacting; flipping back catches up', async () => {
    const { entity: segment } = await createSegment({ type: SegmentType.dynamic, conditions: acmeRule }, { space });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);

    await db.segment.update({ where: { id: segment.id }, data: { type: SegmentType.static } });
    const newcomer = (await createUser({ email: `frozen-${getNextSeq()}@acme.test` })).entity;
    const newcomerRef = await customerOf(newcomer);
    expect(await memberIds(segment.id)).toEqual([acmeRef.id]);

    await db.segment.update({ where: { id: segment.id }, data: { type: SegmentType.dynamic } });
    expect(await memberIds(segment.id)).toEqual([acmeRef.id, newcomerRef.id].sort());
  });
});
