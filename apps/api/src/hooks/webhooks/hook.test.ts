import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  spyOn,
} from 'bun:test';
import { randomUUID } from 'node:crypto';
import { clearHookRegistry, db } from '@template/db';
import { IntegrationOwnerModel, WebhookModel } from '@template/db/generated/client/enums';
import { auditActorContext, nullAuditActor } from '@template/db/lib/auditActorContext';
import {
  cleanupTouchedTables,
  createCustomerRef,
  createIntegration,
  createOrganization,
  createSpace,
  createUser,
  createWebhookSubscription,
} from '@template/db/test';
import { registerWebhookHook } from '#/hooks/webhooks/hook';
import * as enqueueModule from '#/jobs/enqueue';
import { processJob } from '#/jobs/processJob';
import { JobType } from '#/jobs/types';
import { createMockJob } from '#tests/createTestWorker';

registerWebhookHook();

type Enqueued = { subscriptionId: string; action: string; resourceId: string };

let enqueueSpy: Mock<typeof enqueueModule.enqueueJob>;

beforeEach(() => {
  enqueueSpy = spyOn(enqueueModule, 'enqueueJob').mockResolvedValue({
    jobId: 'mock',
    name: 'sendWebhook',
  });
});

afterEach(() => {
  enqueueSpy.mockRestore();
});

afterAll(async () => {
  await cleanupTouchedTables(db);
  clearHookRegistry();
});

const enqueued = () => enqueueSpy.mock.calls.map(([, payload]) => payload as Enqueued);
const deliveredTo = (subscriptionId: string) =>
  enqueued().filter((payload) => payload.subscriptionId === subscriptionId);

const subscribeUser = async (userId: string, isActive = true) =>
  (
    await createWebhookSubscription({
      ownerModel: 'User',
      userId,
      model: WebhookModel.CustomerRef,
      isActive,
    })
  ).entity;

const subscribeOrganization = async (organizationId: string) =>
  (
    await createWebhookSubscription({
      ownerModel: 'Organization',
      organizationId,
      model: WebhookModel.CustomerRef,
    })
  ).entity;

const subscribeSpace = async (spaceId: string) =>
  (
    await createWebhookSubscription({
      ownerModel: 'Space',
      spaceId,
      model: WebhookModel.CustomerRef,
    })
  ).entity;

describe('webhook hook — tenancy', () => {
  let customerId: string;
  let providerOrganizationId: string;
  let customerSub: { id: string };
  let providerSub: { id: string };
  let outsiderSub: { id: string };
  let inactiveCustomerSub: { id: string };
  let inactiveCustomerId: string;

  beforeAll(async () => {
    const { entity: customer } = await createUser();
    const { entity: other } = await createUser();
    const { entity: providerOrganization } = await createOrganization();
    const { entity: outsiderOrganization } = await createOrganization();
    customerId = customer.id;
    inactiveCustomerId = other.id;
    providerOrganizationId = providerOrganization.id;

    customerSub = await subscribeUser(customer.id);
    providerSub = await subscribeOrganization(providerOrganization.id);
    outsiderSub = await subscribeOrganization(outsiderOrganization.id);
    inactiveCustomerSub = await subscribeUser(other.id, false);
  });

  const subscribedCustomer = async () => {
    const { entity: customer } = await createUser();
    return { customerUserId: customer.id, sub: await subscribeUser(customer.id) };
  };

  const createRef = async (customerUserId: string) =>
    (
      await createCustomerRef({
        customerModel: 'User',
        providerModel: 'Organization',
        customerUserId,
        providerOrganizationId,
      })
    ).entity;

  it('delivers a CustomerRef create to its two parties only, once each', async () => {
    const ref = await createRef(customerId);

    expect(deliveredTo(customerSub.id)).toEqual([
      expect.objectContaining({ action: 'create', resourceId: ref.id }),
    ]);
    expect(deliveredTo(providerSub.id)).toEqual([
      expect.objectContaining({ action: 'create', resourceId: ref.id }),
    ]);
    expect(deliveredTo(outsiderSub.id)).toEqual([]);
  });

  it('delivers updates to the parties and skips no-op updates', async () => {
    const { customerUserId, sub } = await subscribedCustomer();
    const ref = await createRef(customerUserId);
    enqueueSpy.mockClear();

    await db.customerRef.update({ where: { id: ref.id }, data: { acceptedKinds: ['platform'] } });
    expect(
      enqueued()
        .map((payload) => payload.subscriptionId)
        .sort(),
    ).toEqual([sub.id, providerSub.id].sort());
    expect(enqueued().every((payload) => payload.action === 'update')).toBe(true);

    enqueueSpy.mockClear();
    await db.customerRef.update({ where: { id: ref.id }, data: { acceptedKinds: ['platform'] } });
    expect(enqueued()).toEqual([]);
  });

  it('delivers deletes to the parties of the deleted row', async () => {
    const { customerUserId, sub } = await subscribedCustomer();
    const ref = await createRef(customerUserId);
    enqueueSpy.mockClear();

    await db.customerRef.delete({ where: { id: ref.id } });

    expect(deliveredTo(sub.id)).toEqual([
      expect.objectContaining({ action: 'delete', resourceId: ref.id }),
    ]);
    expect(deliveredTo(providerSub.id)).toEqual([
      expect.objectContaining({ action: 'delete', resourceId: ref.id }),
    ]);
    expect(deliveredTo(outsiderSub.id)).toEqual([]);
  });

  it('delivers upserts on both paths to the parties', async () => {
    const { customerUserId, sub } = await subscribedCustomer();
    const id = randomUUID();
    const upsert = () =>
      db.customerRef.upsert({
        where: { id },
        create: {
          id,
          customerModel: 'User',
          providerModel: 'Organization',
          customerUserId,
          providerOrganizationId,
        },
        update: { acceptedKinds: ['platform'] },
      });
    enqueueSpy.mockClear();

    await upsert();
    await upsert();

    expect(deliveredTo(sub.id)).toEqual([
      expect.objectContaining({ action: 'create', resourceId: id }),
      expect.objectContaining({ action: 'update', resourceId: id }),
    ]);
    expect(deliveredTo(providerSub.id).map((payload) => payload.action)).toEqual([
      'create',
      'update',
    ]);
    expect(deliveredTo(outsiderSub.id)).toEqual([]);
  });

  it('routes each row of a bulk write to its own parties', async () => {
    const { entity: otherProvider } = await createOrganization();
    const otherProviderSub = await subscribeOrganization(otherProvider.id);
    const { entity: customerA } = await createUser();
    const { entity: customerB } = await createUser();
    enqueueSpy.mockClear();

    const rows = await db.customerRef.createManyAndReturn({
      data: [
        {
          customerModel: 'User',
          providerModel: 'Organization',
          customerUserId: customerA.id,
          providerOrganizationId,
        },
        {
          customerModel: 'User',
          providerModel: 'Organization',
          customerUserId: customerB.id,
          providerOrganizationId: otherProvider.id,
        },
      ],
    });
    const refA = rows.find((row) => row.customerUserId === customerA.id)?.id ?? '';
    const refB = rows.find((row) => row.customerUserId === customerB.id)?.id ?? '';

    expect(deliveredTo(providerSub.id).map((payload) => payload.resourceId)).toEqual([refA]);
    expect(deliveredTo(otherProviderSub.id).map((payload) => payload.resourceId)).toEqual([refB]);
    expect(deliveredTo(outsiderSub.id)).toEqual([]);

    enqueueSpy.mockClear();
    await db.customerRef.updateManyAndReturn({
      where: { id: { in: rows.map((row) => row.id) } },
      data: { acceptedKinds: ['activity'] },
    });
    expect(deliveredTo(providerSub.id).map((payload) => payload.resourceId)).toEqual([refA]);
    expect(deliveredTo(otherProviderSub.id).map((payload) => payload.resourceId)).toEqual([refB]);
    expect(deliveredTo(outsiderSub.id)).toEqual([]);
  });

  it('skips inactive subscriptions of a party', async () => {
    await createRef(inactiveCustomerId);

    expect(deliveredTo(inactiveCustomerSub.id)).toEqual([]);
    expect(deliveredTo(providerSub.id).length).toBe(1);
  });

  it('delivers a Space party to the Space subscription, not to its organization (no inheritance yet)', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    const spaceSub = await subscribeSpace(space.id);
    const organizationSub = await subscribeOrganization(organization.id);
    enqueueSpy.mockClear();

    const { entity: ref } = await createCustomerRef({
      customerModel: 'User',
      providerModel: 'Space',
      customerUserId: customerId,
      providerSpaceId: space.id,
    });

    expect(deliveredTo(spaceSub.id)).toEqual([expect.objectContaining({ resourceId: ref.id })]);
    expect(deliveredTo(organizationSub.id)).toEqual([]);
  });

  it('AUTH-006 regression: an unrelated organization hears nothing about a user it has no CustomerRef with', async () => {
    const { entity: user } = await createUser();
    enqueueSpy.mockClear();

    await db.user.update({ where: { id: user.id }, data: { name: 'Changed Name' } });

    expect(deliveredTo(outsiderSub.id)).toEqual([]);
    expect(enqueued()).toEqual([]);
  });

  it('a party change emits no CustomerRef events, even to the parties', async () => {
    const { entity: organization } = await createOrganization();
    const { entity: space } = await createSpace({}, { organization });
    await createCustomerRef({
      customerModel: 'User',
      providerModel: 'Space',
      customerUserId: customerId,
      providerSpaceId: space.id,
    });
    enqueueSpy.mockClear();

    await db.user.update({ where: { id: customerId }, data: { name: 'Party Changed' } });
    await db.organization.update({
      where: { id: providerOrganizationId },
      data: { name: 'Provider Changed' },
    });
    await db.space.update({ where: { id: space.id }, data: { name: 'Space Changed' } });

    expect(enqueued()).toEqual([]);
  });
});

describe('webhook hook — origin suppression', () => {
  let customerRefId: string;
  let sfIntegrationId: string;
  let sfSub: { id: string };
  let hsSub: { id: string };
  let plainSub: { id: string };

  beforeAll(async () => {
    const { entity: user, context } = await createUser();
    const { entity: customer } = await createUser();

    const { entity: sfIntegration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: user.id, name: 'Salesforce' },
      context,
    );
    const { entity: hsIntegration } = await createIntegration(
      { ownerModel: IntegrationOwnerModel.User, userId: user.id, name: 'HubSpot' },
      context,
    );
    sfIntegrationId = sfIntegration.id;

    const subscribe = async (integrationId?: string) =>
      (
        await createWebhookSubscription(
          { ownerModel: 'User', model: WebhookModel.CustomerRef, integrationId },
          context,
        )
      ).entity;
    sfSub = await subscribe(sfIntegration.id);
    hsSub = await subscribe(hsIntegration.id);
    plainSub = await subscribe();

    const { entity: ref } = await createCustomerRef({
      customerModel: 'User',
      providerModel: 'User',
      customerUserId: customer.id,
      providerUserId: user.id,
    });
    customerRefId = ref.id;
  });

  const touchRef = (kinds: ('platform' | 'activity' | 'marketing')[]) =>
    db.customerRef.update({ where: { id: customerRefId }, data: { acceptedKinds: kinds } });

  const deliveredSubIds = () => enqueued().map((payload) => payload.subscriptionId);

  it('skips the subscription whose integration is the write origin, delivers to the rest', async () => {
    await auditActorContext.scope(
      { ...nullAuditActor, integrationId: sfIntegrationId },
      async () => {
        await touchRef(['marketing']);
      },
    );

    const delivered = deliveredSubIds();
    expect(delivered).toContain(hsSub.id);
    expect(delivered).toContain(plainSub.id);
    expect(delivered).not.toContain(sfSub.id);
  });

  it('skips the subscription of the integration a job writes for', async () => {
    const handlers = {
      sendWebhook: async () => {
        await touchRef(['activity']);
      },
    };
    await processJob(
      createMockJob({
        id: 'sync-sf',
        name: 'sendWebhook',
        data: { type: JobType.adhoc, payload: { integrationId: sfIntegrationId } },
      }),
      { handlers: handlers as never },
    );

    const delivered = deliveredSubIds();
    expect(delivered).toContain(hsSub.id);
    expect(delivered).toContain(plainSub.id);
    expect(delivered).not.toContain(sfSub.id);
  });

  it('delivers to every party subscription when the write has no origin', async () => {
    await touchRef(['platform', 'marketing']);

    const delivered = deliveredSubIds();
    expect(delivered).toContain(sfSub.id);
    expect(delivered).toContain(hsSub.id);
    expect(delivered).toContain(plainSub.id);
  });
});
