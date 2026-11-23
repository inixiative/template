import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { createHmac } from 'node:crypto';
import { db } from '@template/db';
import type {
  BillingAccount,
  BillingResource,
  Integration,
  Organization,
  OrganizationUser,
  Project,
  ProjectIntegration,
  Space,
  SpaceUser,
  User,
} from '@template/db/generated/client/client';
import {
  BillingAccountOwnerModel,
  BillingAccountSharing,
  BillingAccountStatus,
  BillingProvider,
  BillingResourceTargetModel,
  BillingWebhookEventStatus,
  EntitlementResourceModel,
  EntitlementTargetModel,
  InquiryStatus,
  InquiryType,
  Role,
  SettingResourceModel,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createBillingAccount,
  createBillingResource,
  createBillingWebhookEvent,
  createEntitlement,
  createInquiry,
  createIntegration,
  createOrganization,
  createOrganizationUser,
  createProject,
  createProjectIntegration,
  createSetting,
  createSpace,
  createSpaceUser,
  createUser,
} from '@template/db/test';
import { type BillingClient, billingRegistry } from '#/lib/billing';
import { createPolarBillingClient } from '#/lib/billing/client/polar';
import { billingAccountRouter } from '#/modules/billingAccount';
import { billingResourceRouter } from '#/modules/billingResource';
import { inquiryRouter } from '#/modules/inquiry';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { organizationUserRouter } from '#/modules/organizationUser';
import { spaceRouter } from '#/modules/space';
import { spaceUserRouter } from '#/modules/spaceUser';
import { billingWebhooksRouter } from '#/routes/billingWebhooks';
import { createTestApp } from '#tests/createTestApp';
import { del, get, parseSuccessBody, patch, post } from '#tests/utils/request';

const appFor = (user: User, organizationUsers: OrganizationUser[], spaceUsers: SpaceUser[] = []) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: organizationUsers,
    mockSpaceUsers: spaceUsers,
    mount: [
      (app) => app.route('/api/v1/me', meRouter),
      (app) => app.route('/api/v1/organization', organizationRouter),
      (app) => app.route('/api/v1/space', spaceRouter),
      (app) => app.route('/api/v1/organizationUser', organizationUserRouter),
      (app) => app.route('/api/v1/spaceUser', spaceUserRouter),
      (app) => app.route('/api/v1/billingAccount', billingAccountRouter),
      (app) => app.route('/api/v1/billingResource', billingResourceRouter),
      (app) => app.route('/api/v1/inquiry', inquiryRouter),
      (app) => app.route('/api/webhooks/billing', billingWebhooksRouter),
    ],
  });

const signWebhook = (secret: string, id: string, ts: string, rawBody: string): string => {
  const key = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const sig = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest('base64');
  return `v1,${sig}`;
};

describe('FIN-001 BillingAccount, BillingResource, governance settings, sharing, resolution & webhooks', () => {
  let adminUser: User;
  let memberUser: User;
  let viewerUser: User;
  let org: Organization;
  let adminOrgMember: OrganizationUser;
  let regularOrgMember: OrganizationUser;
  let viewerOrgMember: OrganizationUser;
  let space: Space;
  let adminSpaceMember: SpaceUser;
  let regularSpaceMember: SpaceUser;
  let orgProject: Project;
  let orgIntegration: Integration;
  let projectIntegration: ProjectIntegration;

  beforeEach(async () => {
    const { entity: u1 } = await createUser();
    const { entity: u2 } = await createUser();
    const { entity: u3 } = await createUser();
    adminUser = u1;
    memberUser = u2;
    viewerUser = u3;

    const { entity: o } = await createOrganization();
    org = o;

    const { entity: m1 } = await createOrganizationUser({
      organizationId: org.id,
      userId: adminUser.id,
      role: Role.owner,
    });
    const { entity: m2 } = await createOrganizationUser({
      organizationId: org.id,
      userId: memberUser.id,
      role: Role.member,
    });
    const { entity: m3 } = await createOrganizationUser({
      organizationId: org.id,
      userId: viewerUser.id,
      role: Role.viewer,
    });
    adminOrgMember = m1;
    regularOrgMember = m2;
    viewerOrgMember = m3;

    const { entity: s } = await createSpace({ organizationId: org.id });
    space = s;

    const { entity: sm1 } = await createSpaceUser({
      organizationId: org.id,
      spaceId: space.id,
      userId: adminUser.id,
      role: Role.owner,
    });
    const { entity: sm2 } = await createSpaceUser({
      organizationId: org.id,
      spaceId: space.id,
      userId: memberUser.id,
      role: Role.member,
    });
    adminSpaceMember = sm1;
    regularSpaceMember = sm2;

    const { entity: p } = await createProject({
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    orgProject = p;

    const { entity: integ } = await createIntegration({
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    orgIntegration = integ;

    const { entity: pi } = await createProjectIntegration({
      projectId: orgProject.id,
      integrationId: orgIntegration.id,
    });
    projectIntegration = pi;
  });

  afterEach(async () => {
    await cleanupTouchedTables(db);
  });

  it('enforces default-account invariants and allows deleting the very last account', async () => {
    const { app } = await appFor(adminUser, [adminOrgMember], [adminSpaceMember]);

    const res1 = await app.request(
      post(`/api/v1/organization/${org.id}/billingAccounts`, {
        name: 'Primary Card',
        billingEmail: 'billing@acme.com',
      }),
    );
    expect(res1.status).toBe(201);
    const { data: first } = await parseSuccessBody<BillingAccount>(res1);
    expect(first.isDefault).toBe(true);
    expect(first.status).toBe(BillingAccountStatus.incomplete);
    expect('externalCustomerId' in first).toBe(false);

    const res2 = await app.request(
      post(`/api/v1/organization/${org.id}/billingAccounts`, {
        name: 'Client Card',
        billingEmail: 'billing@acme.com',
      }),
    );
    expect(res2.status).toBe(201);
    const { data: second } = await parseSuccessBody<BillingAccount>(res2);
    expect(second.isDefault).toBe(false);

    const unsetDefault = await app.request(
      patch(`/api/v1/billingAccount/${first.id}`, { isDefault: false }),
    );
    expect(unsetDefault.status).toBe(422);

    const delDefaultWhileSecondExists = await app.request(
      del(`/api/v1/billingAccount/${first.id}`),
    );
    expect(delDefaultWhileSecondExists.status).toBe(422);

    const promote = await app.request(
      patch(`/api/v1/billingAccount/${second.id}`, { isDefault: true }),
    );
    expect(promote.status).toBe(200);
    const { data: promoted } = await parseSuccessBody<BillingAccount>(promote);
    expect(promoted.isDefault).toBe(true);

    const delOldDefault = await app.request(del(`/api/v1/billingAccount/${first.id}`));
    expect(delOldDefault.status).toBe(204);

    const delLastAccount = await app.request(del(`/api/v1/billingAccount/${second.id}`));
    expect(delLastAccount.status).toBe(204);
  });

  it('enforces governance settings across Space, OrganizationUser, and SpaceUser', async () => {
    const { app: adminApp } = await appFor(adminUser, [adminOrgMember], [adminSpaceMember]);
    const { app: memberApp } = await appFor(memberUser, [regularOrgMember], [regularSpaceMember]);

    const spaceDenied = await adminApp.request(
      post(`/api/v1/space/${space.id}/billingAccounts`, {
        name: 'Space Card',
        billingEmail: 'space@acme.com',
      }),
    );
    expect(spaceDenied.status).toBe(403);

    await createSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'billing.allowSpaceBilling',
      valueBoolean: true,
      valueText: null,
    });

    const spaceAllowed = await adminApp.request(
      post(`/api/v1/space/${space.id}/billingAccounts`, {
        name: 'Space Card',
        billingEmail: 'space@acme.com',
      }),
    );
    expect(spaceAllowed.status).toBe(201);

    const orgUserDenied = await memberApp.request(
      post(`/api/v1/organizationUser/${regularOrgMember.id}/billingAccounts`, {
        name: 'Dev Card',
        billingEmail: 'dev@acme.com',
      }),
    );
    expect(orgUserDenied.status).toBe(403);

    await createSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'billing.allowOrgUserBilling',
      valueBoolean: true,
      valueText: null,
    });

    const orgUserAllowed = await memberApp.request(
      post(`/api/v1/organizationUser/${regularOrgMember.id}/billingAccounts`, {
        name: 'Dev Card',
        billingEmail: 'dev@acme.com',
      }),
    );
    expect(orgUserAllowed.status).toBe(201);
    const { data: memberCard } = await parseSuccessBody<BillingAccount>(orgUserAllowed);

    const ownerReadMemberCard = await adminApp.request(
      get(`/api/v1/billingAccount/${memberCard.id}`),
    );
    expect(ownerReadMemberCard.status).toBe(403);
    const ownerDeleteMemberCard = await adminApp.request(
      del(`/api/v1/billingAccount/${memberCard.id}`),
    );
    expect(ownerDeleteMemberCard.status).toBe(403);
    const ownerListMemberCards = await adminApp.request(
      get(`/api/v1/organizationUser/${regularOrgMember.id}/billingAccounts`),
    );
    expect(ownerListMemberCards.status).toBe(200);
    expect((await parseSuccessBody<BillingAccount[]>(ownerListMemberCards)).data).toEqual([]);

    const spaceUserDenied = await memberApp.request(
      post(`/api/v1/spaceUser/${regularSpaceMember.id}/billingAccounts`, {
        name: 'Space Dev Card',
        billingEmail: 'spacedev@acme.com',
      }),
    );
    expect(spaceUserDenied.status).toBe(403);

    await createSetting({
      resourceModel: SettingResourceModel.Space,
      resourceId: space.id,
      resourceOrganizationId: org.id,
      resourceSpaceId: space.id,
      key: 'billing.allowSpaceUserBilling',
      valueBoolean: true,
      valueText: null,
    });
    await createSetting({
      resourceModel: SettingResourceModel.OrganizationUser,
      resourceId: regularOrgMember.id,
      resourceOrganizationId: org.id,
      resourceUserId: memberUser.id,
      key: 'billing.allowSpaceUserBilling',
      valueBoolean: true,
      valueText: null,
    });

    const spaceUserAllowed = await memberApp.request(
      post(`/api/v1/spaceUser/${regularSpaceMember.id}/billingAccounts`, {
        name: 'Space Dev Card',
        billingEmail: 'spacedev@acme.com',
      }),
    );
    expect(spaceUserAllowed.status).toBe(201);
  });

  it('keeps Org BillingAccounts hidden from members unless shared (inherit/on/off) and syncs on setting change', async () => {
    const { app: adminApp } = await appFor(adminUser, [adminOrgMember], [adminSpaceMember]);
    const { app: memberApp } = await appFor(memberUser, [regularOrgMember], [regularSpaceMember]);

    const inheritRes = await adminApp.request(
      post(`/api/v1/organization/${org.id}/billingAccounts`, {
        name: 'Inherited Card',
        billingEmail: 'inherit@acme.com',
        sharing: BillingAccountSharing.inherit,
      }),
    );
    const { data: inheritAccount } = await parseSuccessBody<BillingAccount>(inheritRes);
    expect(inheritAccount.isShared).toBe(false);

    const offRes = await adminApp.request(
      post(`/api/v1/organization/${org.id}/billingAccounts`, {
        name: 'Secret CEO Card',
        billingEmail: 'ceo@acme.com',
        sharing: BillingAccountSharing.off,
      }),
    );
    const { data: offAccount } = await parseSuccessBody<BillingAccount>(offRes);
    expect(offAccount.isShared).toBe(false);

    const onRes = await adminApp.request(
      post(`/api/v1/organization/${org.id}/billingAccounts`, {
        name: 'Shared R&D Card',
        billingEmail: 'rd@acme.com',
        sharing: BillingAccountSharing.on,
      }),
    );
    const { data: onAccount } = await parseSuccessBody<BillingAccount>(onRes);
    expect(onAccount.isShared).toBe(true);

    const memberListBefore = await memberApp.request(
      get(`/api/v1/organization/${org.id}/billingAccounts`),
    );
    expect(memberListBefore.status).toBe(200);
    const { data: visibleBefore } = await parseSuccessBody<BillingAccount[]>(memberListBefore);
    expect(visibleBefore.map((a) => a.id)).toEqual([onAccount.id]);

    const memberBindPrivate = await memberApp.request(
      post('/api/v1/billingResource', {
        billingAccountId: offAccount.id,
        resourceModel: BillingResourceTargetModel.OrganizationUser,
        resourceOrganizationId: org.id,
        resourceUserId: memberUser.id,
      }),
    );
    expect(memberBindPrivate.status).toBe(403);

    const memberBindShared = await memberApp.request(
      post('/api/v1/billingResource', {
        billingAccountId: onAccount.id,
        resourceModel: BillingResourceTargetModel.OrganizationUser,
        resourceOrganizationId: org.id,
        resourceUserId: memberUser.id,
      }),
    );
    expect(memberBindShared.status).toBe(201);

    await createSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'billing.shareAccountsWithMembers',
      valueBoolean: true,
      valueText: null,
    });

    const memberListAfter = await memberApp.request(
      get(`/api/v1/organization/${org.id}/billingAccounts`),
    );
    const { data: visibleAfter } = await parseSuccessBody<BillingAccount[]>(memberListAfter);
    expect(visibleAfter.map((a) => a.id).sort()).toEqual([inheritAccount.id, onAccount.id].sort());
  });

  it('walks resolution narrowest-to-broadest, enforces containment, and redacts PII on /resolve', async () => {
    const { app: adminApp } = await appFor(adminUser, [adminOrgMember], [adminSpaceMember]);
    const { app: viewerApp } = await appFor(viewerUser, [viewerOrgMember]);

    const { entity: orgDefault } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      isDefault: true,
      status: BillingAccountStatus.active,
      sharing: BillingAccountSharing.off,
    });
    const { entity: projectCard } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      isDefault: false,
      status: BillingAccountStatus.pastDue,
      sharing: BillingAccountSharing.off,
    });
    const { entity: piCard } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      isDefault: false,
      status: BillingAccountStatus.active,
      sharing: BillingAccountSharing.off,
    });

    const resolvedDefault = await adminApp.request(
      get(
        `/api/v1/billingResource/resolve?targetModel=ProjectIntegration&id=${projectIntegration.id}`,
      ),
    );
    expect(resolvedDefault.status).toBe(200);
    const { data: d1 } = await parseSuccessBody<{
      resolved: boolean;
      status: BillingAccountStatus;
      source: string;
      boundAt: string;
      billingAccount: BillingAccount | null;
    }>(resolvedDefault);
    expect(d1.resolved).toBe(true);
    expect(d1.source).toBe('ownerDefault');
    expect(d1.boundAt).toBe('Organization');
    expect(d1.billingAccount?.id).toBe(orgDefault.id);

    const viewerResolve = await viewerApp.request(
      get(`/api/v1/billingResource/resolve?targetModel=Project&id=${orgProject.id}`),
    );
    expect(viewerResolve.status).toBe(200);
    const { data: dViewer } = await parseSuccessBody<{
      resolved: boolean;
      status: BillingAccountStatus;
      source: string;
      billingAccount: BillingAccount | null;
    }>(viewerResolve);
    expect(dViewer.resolved).toBe(true);
    expect(dViewer.status).toBe(BillingAccountStatus.active);
    expect(dViewer.billingAccount).toBeNull();

    const bindProj = await adminApp.request(
      post('/api/v1/billingResource', {
        billingAccountId: projectCard.id,
        resourceModel: BillingResourceTargetModel.Project,
        resourceProjectId: orgProject.id,
      }),
    );
    expect(bindProj.status).toBe(201);

    const resolvedPinnedPastDue = await adminApp.request(
      get(
        `/api/v1/billingResource/resolve?targetModel=ProjectIntegration&id=${projectIntegration.id}`,
      ),
    );
    const { data: d2 } = await parseSuccessBody<{
      status: BillingAccountStatus;
      source: string;
      boundAt: string;
      billingAccount: BillingAccount | null;
    }>(resolvedPinnedPastDue);
    expect(d2.source).toBe('binding');
    expect(d2.boundAt).toBe('Project');
    expect(d2.status).toBe(BillingAccountStatus.pastDue);
    expect(d2.billingAccount?.id).toBe(projectCard.id);

    const bindPi = await adminApp.request(
      post('/api/v1/billingResource', {
        billingAccountId: piCard.id,
        resourceModel: BillingResourceTargetModel.ProjectIntegration,
        resourceProjectIntegrationId: projectIntegration.id,
      }),
    );
    expect(bindPi.status).toBe(201);
    const { data: piBinding } = await parseSuccessBody<BillingResource>(bindPi);

    const resolvedPi = await adminApp.request(
      get(
        `/api/v1/billingResource/resolve?targetModel=ProjectIntegration&id=${projectIntegration.id}`,
      ),
    );
    const { data: d3 } = await parseSuccessBody<{
      boundAt: string;
      billingAccount: BillingAccount | null;
    }>(resolvedPi);
    expect(d3.boundAt).toBe('ProjectIntegration');
    expect(d3.billingAccount?.id).toBe(piCard.id);

    const unbindPi = await adminApp.request(del(`/api/v1/billingResource/${piBinding.id}`));
    expect(unbindPi.status).toBe(204);

    const { entity: otherOrg } = await createOrganization();
    const { entity: otherOrgAccount } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: otherOrg.id,
      isDefault: true,
    });
    const { entity: otherOwnerMember } = await createOrganizationUser({
      organizationId: otherOrg.id,
      userId: adminUser.id,
      role: Role.owner,
    });
    const { app: dualAdminApp } = await appFor(
      adminUser,
      [adminOrgMember, otherOwnerMember],
      [adminSpaceMember],
    );
    const crossOrgBind = await dualAdminApp.request(
      post('/api/v1/billingResource', {
        billingAccountId: otherOrgAccount.id,
        resourceModel: BillingResourceTargetModel.Project,
        resourceProjectId: orgProject.id,
      }),
    );
    expect(crossOrgBind.status).toBe(422);
  });

  it('processes signed Polar webhooks idempotently, preserves paymentMethod cache, and reclaims failed retries', async () => {
    const secret = `whsec_${Buffer.from('billing-webhook-test-secret').toString('base64')}`;
    const originalClient = billingRegistry.get(BillingProvider.polar);
    billingRegistry.register(
      BillingProvider.polar,
      createPolarBillingClient({ webhookSecret: secret, sandbox: true }),
    );

    try {
      const { entity: account } = await createBillingAccount({
        ownerModel: BillingAccountOwnerModel.Organization,
        organizationId: org.id,
        isDefault: true,
        status: BillingAccountStatus.incomplete,
        externalCustomerId: 'cus_wh_1',
        paymentMethodType: 'card',
        paymentMethodBrand: 'visa',
        paymentMethodLast4: '4242',
      });

      const { app } = await appFor(adminUser, [adminOrgMember]);
      const now = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'customer.state_changed',
        data: {
          id: 'cus_wh_1',
          external_id: account.id,
          active_subscriptions: [{ id: 'sub_wh_1', status: 'active', cancel_at_period_end: false }],
        },
      });

      const badRes = await app.request('/api/webhooks/billing/polar', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': 'wh_msg_bad',
          'webhook-timestamp': now,
          'webhook-signature': 'v1,bad',
        },
        body: payload,
      });
      expect(badRes.status).toBe(401);

      const sig1 = signWebhook(secret, 'wh_msg_1', now, payload);
      const okRes = await app.request('/api/webhooks/billing/polar', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': 'wh_msg_1',
          'webhook-timestamp': now,
          'webhook-signature': sig1,
        },
        body: payload,
      });
      expect(okRes.status).toBe(200);

      const updated = await db.billingAccount.findUnique({ where: { id: account.id } });
      expect(updated?.status).toBe(BillingAccountStatus.active);
      expect(updated?.externalSubscriptionId).toBe('sub_wh_1');
      expect(updated?.paymentMethodBrand).toBe('visa');
      expect(updated?.paymentMethodLast4).toBe('4242');

      const dupRes = await app.request('/api/webhooks/billing/polar', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': 'wh_msg_1',
          'webhook-timestamp': now,
          'webhook-signature': sig1,
        },
        body: payload,
      });
      expect(dupRes.status).toBe(200);

      await createBillingWebhookEvent({
        provider: BillingProvider.polar,
        externalEventId: 'wh_msg_retry',
        eventType: 'customer.state_changed',
        status: BillingWebhookEventStatus.failed,
        attempts: 1,
        error: 'transient db timeout',
      });

      const pastDuePayload = JSON.stringify({
        type: 'customer.state_changed',
        data: {
          id: 'cus_wh_1',
          external_id: account.id,
          active_subscriptions: [
            { id: 'sub_wh_1', status: 'past_due', cancel_at_period_end: false },
          ],
        },
      });
      const sigRetry = signWebhook(secret, 'wh_msg_retry', now, pastDuePayload);
      const retryRes = await app.request('/api/webhooks/billing/polar', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'webhook-id': 'wh_msg_retry',
          'webhook-timestamp': now,
          'webhook-signature': sigRetry,
        },
        body: pastDuePayload,
      });
      expect(retryRes.status).toBe(200);

      const afterRetry = await db.billingAccount.findUnique({ where: { id: account.id } });
      expect(afterRetry?.status).toBe(BillingAccountStatus.pastDue);

      const webhookRow = await db.billingWebhookEvent.findUnique({
        where: {
          provider_externalEventId: {
            provider: BillingProvider.polar,
            externalEventId: 'wh_msg_retry',
          },
        },
      });
      expect(webhookRow?.status).toBe(BillingWebhookEventStatus.processed);
      expect(webhookRow?.attempts).toBe(2);
    } finally {
      billingRegistry.register(BillingProvider.polar, originalClient);
    }
  });

  it('walks SpaceUser → OrganizationUser → Space → Organization and allows explicit Entitlements on private accounts', async () => {
    await createSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'billing.allowSpaceBilling',
      valueBoolean: true,
      valueText: null,
    });
    await createSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'billing.allowOrgUserBilling',
      valueBoolean: true,
      valueText: null,
    });

    const { entity: orgDefault } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      isDefault: true,
      status: BillingAccountStatus.active,
      sharing: BillingAccountSharing.off,
    });
    const { entity: spaceDefault } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Space,
      organizationId: org.id,
      spaceId: space.id,
      isDefault: true,
      status: BillingAccountStatus.active,
    });
    const { entity: orgUserDefault } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.OrganizationUser,
      organizationId: org.id,
      userId: memberUser.id,
      isDefault: true,
      status: BillingAccountStatus.active,
    });

    const { app: memberApp } = await appFor(memberUser, [regularOrgMember], [regularSpaceMember]);
    const res1 = await memberApp.request(
      get(`/api/v1/billingResource/resolve?targetModel=SpaceUser&id=${regularSpaceMember.id}`),
    );
    expect(res1.status).toBe(200);
    const { data: d1 } = await parseSuccessBody<{
      boundAt: string;
      billingAccount: BillingAccount | null;
    }>(res1);
    expect(d1.boundAt).toBe('OrganizationUser');
    expect(d1.billingAccount?.id).toBe(orgUserDefault.id);

    const { entity: spaceProject } = await createProject({
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });
    const { app: adminApp } = await appFor(adminUser, [adminOrgMember], [adminSpaceMember]);
    const resSpaceProj = await adminApp.request(
      get(`/api/v1/billingResource/resolve?targetModel=Project&id=${spaceProject.id}`),
    );
    const { data: dSpace } = await parseSuccessBody<{
      boundAt: string;
      billingAccount: BillingAccount | null;
    }>(resSpaceProj);
    expect(dSpace.boundAt).toBe('Space');
    expect(dSpace.billingAccount?.id).toBe(spaceDefault.id);

    await createEntitlement({
      resource: EntitlementResourceModel.BillingAccount,
      actions: ['operate'],
      sourceModel: EntitlementResourceModel.BillingAccount,
      sourceId: orgDefault.id,
      sourceBillingAccountId: orgDefault.id,
      targetModel: EntitlementTargetModel.OrganizationUser,
      targetId: regularOrgMember.id,
      targetOrganizationId: org.id,
      targetUserId: memberUser.id,
    });

    const { app: entitledMemberApp } = await appFor(
      memberUser,
      [regularOrgMember],
      [regularSpaceMember],
    );
    const bindPrivateWithEntitlement = await entitledMemberApp.request(
      post('/api/v1/billingResource', {
        billingAccountId: orgDefault.id,
        resourceModel: BillingResourceTargetModel.OrganizationUser,
        resourceOrganizationId: org.id,
        resourceUserId: memberUser.id,
      }),
    );
    expect(bindPrivateWithEntitlement.status).toBe(201);
  });

  it('reconciles disallowed sub-owner bindings when governance flips off and cleans up Org A bindings on transferSpace', async () => {
    const { entity: allowSpaceSetting } = await createSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceId: org.id,
      resourceOrganizationId: org.id,
      key: 'billing.allowSpaceBilling',
      valueBoolean: true,
      valueText: null,
    });
    const { entity: orgAccount } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      isDefault: true,
      status: BillingAccountStatus.active,
    });
    const { entity: spaceAccount } = await createBillingAccount({
      ownerModel: BillingAccountOwnerModel.Space,
      organizationId: org.id,
      spaceId: space.id,
      isDefault: true,
      status: BillingAccountStatus.active,
    });
    const { entity: spaceProject } = await createProject({
      ownerModel: 'Space',
      organizationId: org.id,
      spaceId: space.id,
    });
    const { entity: spaceBinding } = await createBillingResource({
      billingAccountId: spaceAccount.id,
      resourceModel: BillingResourceTargetModel.Project,
      resourceProjectId: spaceProject.id,
    });

    await db.setting.update({
      where: { id: allowSpaceSetting.id },
      data: { valueBoolean: false },
    });

    const refreshedSpaceBinding = await db.withDeleted(() =>
      db.billingResource.findUnique({ where: { id: spaceBinding.id } }),
    );
    expect(refreshedSpaceBinding?.deletedAt).not.toBeNull();

    await db.setting.update({
      where: { id: allowSpaceSetting.id },
      data: { valueBoolean: true },
    });

    const { entity: orgBindingOnSpaceProject } = await createBillingResource({
      billingAccountId: orgAccount.id,
      resourceModel: BillingResourceTargetModel.Project,
      resourceProjectId: spaceProject.id,
    });
    const { entity: spaceBindingOnSpace } = await createBillingResource({
      billingAccountId: spaceAccount.id,
      resourceModel: BillingResourceTargetModel.Space,
      resourceOrganizationId: org.id,
      resourceSpaceId: space.id,
    });

    const { entity: targetOrg } = await createOrganization();
    await createSetting({
      resourceModel: SettingResourceModel.Organization,
      resourceId: targetOrg.id,
      resourceOrganizationId: targetOrg.id,
      key: 'billing.allowSpaceBilling',
      valueBoolean: true,
      valueText: null,
    });
    const { entity: targetOwnerMember } = await createOrganizationUser({
      organizationId: targetOrg.id,
      userId: adminUser.id,
      role: Role.owner,
    });
    const { entity: transferInquiry } = await createInquiry({
      type: InquiryType.transferSpace,
      status: InquiryStatus.sent,
      sourceModel: 'Space',
      sourceOrganizationId: org.id,
      sourceSpaceId: space.id,
      sourceId: space.id,
      targetModel: 'Organization',
      targetOrganizationId: targetOrg.id,
      targetId: targetOrg.id,
      content: { slug: `${space.slug}-moved` },
    });

    const { app: transferApp } = await appFor(
      adminUser,
      [adminOrgMember, targetOwnerMember],
      [adminSpaceMember],
    );
    const approveRes = await transferApp.request(
      post(`/api/v1/inquiry/${transferInquiry.id}/resolve`, {
        expectedUpdatedAt: new Date(transferInquiry.updatedAt).toISOString(),
        status: InquiryStatus.approved,
        explanation: 'approved transfer',
      }),
    );
    expect(approveRes.status).toBe(200);

    const oldOrgBinding = await db.withDeleted(() =>
      db.billingResource.findUnique({ where: { id: orgBindingOnSpaceProject.id } }),
    );
    expect(oldOrgBinding?.deletedAt).not.toBeNull();

    const keptSpaceBinding = await db.withDeleted(() =>
      db.billingResource.findUnique({ where: { id: spaceBindingOnSpace.id } }),
    );
    expect(keptSpaceBinding?.deletedAt).toBeNull();
  });

  it('provisions setup/portal sessions, syncs provider state, and calls cancelAccount when deleting the last account', async () => {
    const { app: userApp } = await appFor(adminUser, [adminOrgMember]);
    const originalClient = billingRegistry.get(BillingProvider.polar);
    const canceledCustomerIds: string[] = [];

    const stubClient: BillingClient = {
      provider: BillingProvider.polar,
      capabilities: originalClient.capabilities,
      ensureCustomer: async ({ accountId }) => ({
        externalCustomerId: `ext_cust_${accountId}`,
      }),
      updateCustomer: async () => undefined,
      createSetupSession: async ({ externalCustomerId, returnUrl }) => ({
        url: `https://sandbox.polar.sh/checkout/${externalCustomerId}?return=${encodeURIComponent(returnUrl)}`,
        externalSessionId: `chk_${externalCustomerId}`,
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
      createPortalSession: async ({ externalCustomerId, returnUrl }) => ({
        url: `https://sandbox.polar.sh/portal/${externalCustomerId}?return=${encodeURIComponent(returnUrl)}`,
      }),
      fetchAccountState: async ({ externalCustomerId }) => ({
        externalCustomerId,
        externalSubscriptionId: 'sub_1',
        status: BillingAccountStatus.active,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        paymentMethod: {
          type: 'card',
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2029,
        },
      }),
      ingestUsageEvents: async (events) => ({
        accepted: events.length,
        rejected: [],
      }),
      cancelAccount: async ({ externalCustomerId }) => {
        canceledCustomerIds.push(externalCustomerId);
        return { status: BillingAccountStatus.canceled };
      },
      parseWebhook: originalClient.parseWebhook,
    };

    billingRegistry.register(BillingProvider.polar, stubClient);
    try {
      const createRes = await userApp.request(
        post('/api/v1/me/billingAccounts', {
          name: 'Personal Card',
          billingEmail: 'personal@acme.com',
        }),
      );
      expect(createRes.status).toBe(201);
      const { data: created } = await parseSuccessBody<BillingAccount>(createRes);
      expect(created.isDefault).toBe(true);
      expect(created.externalCustomerId).toBeUndefined();
      const storedBefore = await db.billingAccount.findUnique({ where: { id: created.id } });
      expect(storedBefore?.externalCustomerId).toBeNull();

      const setupRes = await userApp.request(
        post(`/api/v1/billingAccount/${created.id}/setupSession`, {
          successUrl: 'https://app.example.com/billing?done=1',
          returnUrl: 'https://app.example.com/billing',
        }),
      );
      expect(setupRes.status).toBe(200);
      const { data: setupData } = await parseSuccessBody<{ url: string }>(setupRes);
      expect(setupData.url).toContain(`ext_cust_${created.id}`);

      const portalRes = await userApp.request(
        post(`/api/v1/billingAccount/${created.id}/portalSession`, {
          returnUrl: 'https://app.example.com/billing',
        }),
      );
      expect(portalRes.status).toBe(200);
      const { data: portalData } = await parseSuccessBody<{ url: string }>(portalRes);
      expect(portalData.url).toContain(`ext_cust_${created.id}`);

      const syncRes = await userApp.request(post(`/api/v1/billingAccount/${created.id}/sync`, {}));
      expect(syncRes.status).toBe(200);
      const { data: synced } = await parseSuccessBody<BillingAccount>(syncRes);
      expect(synced.status).toBe(BillingAccountStatus.active);
      expect(synced.paymentMethodBrand).toBe('visa');
      expect(synced.paymentMethodLast4).toBe('4242');

      const delRes = await userApp.request(del(`/api/v1/billingAccount/${created.id}`));
      expect(delRes.status).toBe(204);
      expect(canceledCustomerIds).toEqual([`ext_cust_${created.id}`]);
    } finally {
      billingRegistry.register(BillingProvider.polar, originalClient);
    }
  });
});
