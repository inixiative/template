import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Organization, User } from '@template/db/generated/client/client';
import {
  InquiryResourceModel,
  InquiryStatus,
  InquiryType,
  TokenOwnerModel,
} from '@template/db/generated/client/enums';
import {
  cleanupTouchedTables,
  createFlow as createFlowRow,
  createInquiry,
  createOrganization,
  createOrganizationUser,
  createToken,
  createUser,
} from '@template/db/test';
import { flowRouter } from '#/modules/flow';
import type { FlowResponse } from '#/modules/flow/schemas/flowSchemas';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { get, json, jsonError, post } from '#tests/utils/request';

describe('flows', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let owner: User;
  let org: Organization;
  let memberOnlyOrg: Organization;
  let foreignOrg: Organization;

  beforeAll(async () => {
    owner = (await createUser()).entity;
    org = (await createOrganization()).entity;
    memberOnlyOrg = (await createOrganization()).entity;
    foreignOrg = (await createOrganization()).entity;
    const { entity: ownerSeat } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization: org },
    );
    const { entity: memberSeat } = await createOrganizationUser(
      { role: 'member' },
      { user: owner, organization: memberOnlyOrg },
    );

    const harness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [ownerSeat, memberSeat],
      mount: [
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/flow', flowRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const start = async (organizationId: string) =>
    fetch(
      post('/api/v1/me/flows', {
        flowKey: 'setUpOrganization',
        params: { organizationId },
        returnUrl: '/dashboard',
      }),
    );

  const startFor = async (organization: Organization) => {
    const response = await start(organization.id);
    expect(response.status).toBe(201);
    return (await json<FlowResponse>(response)).data;
  };

  const check = async (flowId: string) => {
    const response = await fetch(post(`/api/v1/flow/${flowId}/check`));
    expect(response.status).toBe(200);
    return (await json<FlowResponse>(response)).data;
  };

  const sendInvite = async (
    organization: Organization,
    status: InquiryStatus = InquiryStatus.sent,
  ) => {
    const { entity: invitee } = await createUser();
    await createInquiry({
      type: InquiryType.inviteOrganizationUser,
      status,
      sourceModel: InquiryResourceModel.Organization,
      sourceOrganizationId: organization.id,
      targetModel: InquiryResourceModel.User,
      targetUserId: invitee.id,
      content: { role: 'member' },
    });
  };

  const createOrganizationToken = (organization: Organization) =>
    createToken({ ownerModel: TokenOwnerModel.Organization }, { organization });

  it('advances only when the bound route shows enough rows, through every step to completion', async () => {
    const { entity: freshOrg } = await createOrganization();
    const { entity: seat } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization: freshOrg },
    );
    const harness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [seat],
      mount: [
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/flow', flowRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    const startResponse = await harness.fetch(
      post('/api/v1/me/flows', {
        flowKey: 'setUpOrganization',
        params: { organizationId: freshOrg.id },
        returnUrl: '/dashboard',
      }),
    );
    const started = (await json<FlowResponse>(startResponse)).data;
    const checkFresh = async () =>
      (await json<FlowResponse>(await harness.fetch(post(`/api/v1/flow/${started.id}/check`))))
        .data;

    expect(startResponse.status).toBe(201);
    expect(started.currentStep).toBe(0);
    expect(started.progress).toEqual({ count: 0, required: 1 });
    expect(started.flowSteps.map((step) => [step.key, step.mode, step.url])).toEqual([
      ['inviteTeammate', 'navigate', `/users/members?org=${freshOrg.id}`],
      ['inviteAnother', 'anchor', `/users/members?org=${freshOrg.id}#invite`],
      ['createApiTokens', 'navigate', `/settings/tokens?org=${freshOrg.id}#create-token`],
    ]);

    expect((await checkFresh()).currentStep).toBe(0);

    await sendInvite(freshOrg, InquiryStatus.draft);
    const afterDraft = await checkFresh();
    expect(afterDraft.currentStep).toBe(0);
    expect(afterDraft.progress).toEqual({ count: 0, required: 1 });

    await sendInvite(freshOrg);
    const afterFirstInvite = await checkFresh();
    expect(afterFirstInvite.currentStep).toBe(1);
    expect(afterFirstInvite.progress).toEqual({ count: 1, required: 2 });
    expect(afterFirstInvite.flowSteps[0]!.completedAt).not.toBeNull();

    await sendInvite(freshOrg);
    const afterSecondInvite = await checkFresh();
    expect(afterSecondInvite.currentStep).toBe(2);
    expect(afterSecondInvite.progress).toEqual({ count: 0, required: 2 });

    await createOrganizationToken(freshOrg);
    const afterOneToken = await checkFresh();
    expect(afterOneToken.currentStep).toBe(2);
    expect(afterOneToken.progress).toEqual({ count: 1, required: 2 });

    await createOrganizationToken(freshOrg);
    const completed = await checkFresh();
    expect(completed.currentStep).toBe(3);
    expect(completed.completedAt).not.toBeNull();
    expect(completed.progress).toBeNull();
    expect(completed.returnUrl).toBe('/dashboard');
    expect(completed.flowSteps.every((step) => step.completedAt !== null)).toBe(true);
  });

  it('completes steps that already hold at start, in one pass', async () => {
    const { entity: busyOrg } = await createOrganization();
    const { entity: seat } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization: busyOrg },
    );
    await sendInvite(busyOrg);
    await sendInvite(busyOrg);
    const harness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [seat],
      mount: [
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/flow', flowRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });

    const response = await harness.fetch(
      post('/api/v1/me/flows', {
        flowKey: 'setUpOrganization',
        params: { organizationId: busyOrg.id },
        returnUrl: '/dashboard',
      }),
    );

    expect((await json<FlowResponse>(response)).data.currentStep).toBe(2);
  });

  it('reading a flow never advances it, even when the rule now holds', async () => {
    const { entity: quietOrg } = await createOrganization();
    const { entity: seat } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization: quietOrg },
    );
    const harness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [seat],
      mount: [
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/flow', flowRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    const started = (
      await json<FlowResponse>(
        await harness.fetch(
          post('/api/v1/me/flows', {
            flowKey: 'setUpOrganization',
            params: { organizationId: quietOrg.id },
            returnUrl: '/dashboard',
          }),
        ),
      )
    ).data;
    await sendInvite(quietOrg);

    const read = (await json<FlowResponse>(await harness.fetch(get(`/api/v1/flow/${started.id}`))))
      .data;

    expect(read.currentStep).toBe(0);
    expect(read.progress).toEqual({ count: 1, required: 1 });
    const stored = await db.flow.findUniqueOrThrow({ where: { id: started.id } });
    expect(stored.currentStep).toBe(0);
  });

  it('never counts rows the bound route would not return to this user', async () => {
    const flow = await startFor(org);
    await sendInvite(foreignOrg);
    await sendInvite(foreignOrg);
    await createOrganizationToken(foreignOrg);
    await createOrganizationToken(foreignOrg);

    const checked = await check(flow.id);

    expect(checked.currentStep).toBe(flow.currentStep);
    expect(checked.progress?.count).toBe(flow.progress?.count);
  });

  it('refuses to start a flow over data the user cannot read', async () => {
    const foreign = await start(foreignOrg.id);
    expect(foreign.status).toBe(403);

    const memberOnly = await start(memberOnlyOrg.id);
    expect(memberOnly.status).toBe(403);
    expect((await jsonError(memberOnly)).message).toBe('You cannot see the data this flow checks');
  });

  it('refuses invalid params and unknown flows at start', async () => {
    const badParams = await fetch(
      post('/api/v1/me/flows', {
        flowKey: 'setUpOrganization',
        params: { organizationId: 'not-a-uuid' },
        returnUrl: '/dashboard',
      }),
    );
    expect(badParams.status).toBe(400);
    expect((await jsonError(badParams)).message).toBe(
      'Invalid params for flow "setUpOrganization"',
    );

    const missingParams = await fetch(
      post('/api/v1/me/flows', { flowKey: 'setUpOrganization', returnUrl: '/dashboard' }),
    );
    expect(missingParams.status).toBe(400);

    const unknownFlow = await fetch(
      post('/api/v1/me/flows', { flowKey: 'nope', params: {}, returnUrl: '/dashboard' }),
    );
    expect(unknownFlow.status).toBe(400);
  });

  it('accepts only paths inside the app for the returnUrl', async () => {
    for (const returnUrl of [
      'https://evil.example/x',
      '//evil.example/x',
      '/\\evil.example',
      '/.//evil.example',
      '/\t/evil.example',
      'javascript:alert(1)',
      'relative',
    ]) {
      const response = await fetch(
        post('/api/v1/me/flows', {
          flowKey: 'setUpOrganization',
          params: { organizationId: org.id },
          returnUrl,
        }),
      );
      expect(response.status).toBe(400);
    }
  });

  it('cancels and returns the returnUrl; a canceled flow never advances', async () => {
    const flow = await startFor(org);

    const canceled = await fetch(post(`/api/v1/flow/${flow.id}/cancel`));
    const { data } = await json<FlowResponse>(canceled);
    expect(canceled.status).toBe(200);
    expect(data.returnUrl).toBe('/dashboard');
    expect(data.canceledAt).not.toBeNull();

    const again = await fetch(post(`/api/v1/flow/${flow.id}/cancel`));
    expect((await json<FlowResponse>(again)).data.canceledAt).toBe(data.canceledAt);

    await sendInvite(org);
    await sendInvite(org);
    const checked = await check(flow.id);
    expect(checked.currentStep).toBe(flow.currentStep);
    expect(checked.completedAt).toBeNull();
  });

  it('two concurrent checks record each completed step once', async () => {
    const { entity: raceOrg } = await createOrganization();
    const { entity: seat } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization: raceOrg },
    );
    const harness = createTestApp({
      mockUser: owner,
      mockOrganizationUsers: [seat],
      mount: [
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/flow', flowRouter),
        (app) => app.route('/api/v1/organization', organizationRouter),
      ],
    });
    const started = (
      await json<FlowResponse>(
        await harness.fetch(
          post('/api/v1/me/flows', {
            flowKey: 'setUpOrganization',
            params: { organizationId: raceOrg.id },
            returnUrl: '/dashboard',
          }),
        ),
      )
    ).data;
    await sendInvite(raceOrg);

    const responses = await Promise.all([
      harness.fetch(post(`/api/v1/flow/${started.id}/check`)),
      harness.fetch(post(`/api/v1/flow/${started.id}/check`)),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const stored = await db.flow.findUniqueOrThrow({ where: { id: started.id } });
    expect(stored.currentStep).toBe(1);
    expect(stored.completedSteps).toHaveLength(1);
  });

  it("a stale or foreign flow id is not found or not the user's", async () => {
    const { entity: othersFlow } = await createFlowRow({ params: { organizationId: org.id } });

    expect((await fetch(get(`/api/v1/flow/${othersFlow.id}`))).status).toBe(403);
    expect((await fetch(post(`/api/v1/flow/${othersFlow.id}/check`))).status).toBe(403);
    expect((await fetch(post(`/api/v1/flow/${othersFlow.id}/cancel`))).status).toBe(403);
    expect((await fetch(get('/api/v1/flow/01a12b8e-0000-7000-8000-000000000000'))).status).toBe(
      404,
    );
  });
});
