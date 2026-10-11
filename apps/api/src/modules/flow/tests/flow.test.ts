import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { ArrayOperator, type Condition, Operator } from '@inixiative/json-rules';
import type { Organization, OrganizationUser, User } from '@template/db/generated/client/client';
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
import type { FlowCompletion } from '#/modules/flow/definitions/types';
import type { FlowResponse } from '#/modules/flow/schemas/flowSchemas';
import { evaluateFlowStep } from '#/modules/flow/services/evaluateFlowStep';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { get, json, jsonError, post } from '#tests/utils/request';

const asOwnerOf = async (user: User, organization: Organization) => {
  const { entity: seat } = await createOrganizationUser({ role: 'owner' }, { user, organization });
  return seat;
};

const harnessFor = (user: User, seats: OrganizationUser[]) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: seats,
    mount: [
      (app) => app.route('/api/v1/me', meRouter),
      (app) => app.route('/api/v1/flow', flowRouter),
      (app) => app.route('/api/v1/organization', organizationRouter),
      (app) =>
        app.post('/test/evaluate', async (c) => {
          const completion = (await c.req.json()) as FlowCompletion;
          return c.json({ state: await evaluateFlowStep(c, completion, { userId: user.id }) });
        }),
    ],
  });

type Harness = ReturnType<typeof harnessFor>;

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

const createOrganizationToken = (organization: Organization, name: string) =>
  createToken({ name, ownerModel: TokenOwnerModel.Organization }, { organization });

describe('flows', () => {
  let owner: User;
  let org: Organization;
  let memberOnlyOrg: Organization;
  let foreignOrg: Organization;
  let harness: Harness;

  beforeAll(async () => {
    owner = (await createUser()).entity;
    org = (await createOrganization()).entity;
    memberOnlyOrg = (await createOrganization()).entity;
    foreignOrg = (await createOrganization()).entity;
    const ownerSeat = await asOwnerOf(owner, org);
    const { entity: memberSeat } = await createOrganizationUser(
      { role: 'member' },
      { user: owner, organization: memberOnlyOrg },
    );
    harness = harnessFor(owner, [ownerSeat, memberSeat]);
  });

  afterAll(async () => {
    await cleanupTouchedTables(harness.db);
  });

  const startIn = (app: Harness, organizationId: string) =>
    app.fetch(
      post('/api/v1/me/flows', {
        flowKey: 'setUpOrganization',
        bindings: { organizationId },
        returnUrl: '/dashboard',
      }),
    );

  const started = async (app: Harness, organizationId: string) => {
    const response = await startIn(app, organizationId);
    expect(response.status).toBe(201);
    return (await json<FlowResponse>(response)).data;
  };

  const checkIn = async (app: Harness, flowId: string) => {
    const response = await app.fetch(post(`/api/v1/flow/${flowId}/check`));
    expect(response.status).toBe(200);
    return (await json<FlowResponse>(response)).data;
  };

  const freshOrganization = async () => {
    const { entity: organization } = await createOrganization();
    const seat = await asOwnerOf(owner, organization);
    return { organization, app: harnessFor(owner, [seat]) };
  };

  it('start → rule false, no advance → mutation → check → advance → … → complete', async () => {
    const { organization, app } = await freshOrganization();
    const flow = await started(app, organization.id);

    expect(flow.currentStep).toBe(0);
    expect(
      flow.flowSteps.map(({ key, mode, to, search, hash }) => [key, mode, to, search, hash]),
    ).toEqual([
      ['inviteTeammate', 'navigate', '/users/members', { org: organization.id }, 'invite'],
      ['createCiToken', 'navigate', '/settings/tokens', { org: organization.id }, 'create-token'],
      ['createLocalToken', 'anchor', '/settings/tokens', { org: organization.id }, 'create-token'],
    ]);
    expect((await checkIn(app, flow.id)).currentStep).toBe(0);

    await sendInvite(organization, InquiryStatus.draft);
    expect((await checkIn(app, flow.id)).currentStep).toBe(0);

    await sendInvite(organization);
    const invited = await checkIn(app, flow.id);
    expect(invited.currentStep).toBe(1);
    expect(invited.flowSteps[0]!.completedAt).not.toBeNull();

    await createOrganizationToken(organization, 'ci deploy');
    expect((await checkIn(app, flow.id)).currentStep).toBe(2);

    await createOrganizationToken(organization, 'local dev');
    const completed = await checkIn(app, flow.id);
    expect(completed.currentStep).toBe(3);
    expect(completed.completedAt).not.toBeNull();
    expect(completed.returnUrl).toBe('/dashboard');
    expect(completed.flowSteps.every((step) => step.completedAt !== null)).toBe(true);
  });

  it('against a read-many route, one returned row must match the whole rule', async () => {
    const { organization, app } = await freshOrganization();
    await sendInvite(organization);
    await createOrganizationToken(organization, 'old ci token');
    await Bun.sleep(5);
    const flow = await started(app, organization.id);
    expect(flow.currentStep).toBe(1);

    await createOrganizationToken(organization, 'deploy');
    expect((await checkIn(app, flow.id)).currentStep).toBe(1);

    await createOrganizationToken(organization, 'ci');
    expect((await checkIn(app, flow.id)).currentStep).toBe(2);
  });

  it('a single read with a relation array counts with atLeast, so it takes two actions', async () => {
    const { entity: founder } = await createUser();
    const { entity: first } = await createOrganization();
    const seats = [await asOwnerOf(founder, first)];
    const twoOwnedOrganizations: Condition = {
      field: 'organizationUsers',
      arrayOperator: ArrayOperator.atLeast,
      count: 2,
      condition: { field: 'role', operator: Operator.equals, value: 'owner' },
    };
    const evaluate = async () => {
      const response = await harnessFor(founder, seats).fetch(
        post('/test/evaluate', { read: 'meRead', rule: twoOwnedOrganizations }),
      );
      return ((await response.json()) as { state: string }).state;
    };

    expect(await evaluate()).toBe('pending');

    const { entity: second } = await createOrganization();
    seats.push(await asOwnerOf(founder, second));
    expect(await evaluate()).toBe('holds');
  });

  it('never counts rows the bound route would not return to this user', async () => {
    const flow = await started(harness, org.id);
    await sendInvite(foreignOrg);
    await createOrganizationToken(foreignOrg, 'ci');

    const checked = await checkIn(harness, flow.id);

    expect(checked.currentStep).toBe(flow.currentStep);
  });

  it('refuses to start a flow over data the user cannot read', async () => {
    expect((await startIn(harness, foreignOrg.id)).status).toBe(403);

    const memberOnly = await startIn(harness, memberOnlyOrg.id);
    expect(memberOnly.status).toBe(403);
    expect((await jsonError(memberOnly)).message).toBe('You cannot see the data this flow checks');
  });

  it('refuses invalid bindings and unknown flows at start', async () => {
    const invalid = await harness.fetch(
      post('/api/v1/me/flows', {
        flowKey: 'setUpOrganization',
        bindings: { organizationId: 'not-a-uuid' },
        returnUrl: '/dashboard',
      }),
    );
    expect(invalid.status).toBe(400);
    expect((await jsonError(invalid)).message).toBe(
      'Invalid bindings for flow "setUpOrganization"',
    );

    const missing = await harness.fetch(
      post('/api/v1/me/flows', { flowKey: 'setUpOrganization', returnUrl: '/dashboard' }),
    );
    expect(missing.status).toBe(400);

    const unknown = await harness.fetch(
      post('/api/v1/me/flows', { flowKey: 'nope', bindings: {}, returnUrl: '/dashboard' }),
    );
    expect(unknown.status).toBe(400);
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
      const response = await harness.fetch(
        post('/api/v1/me/flows', {
          flowKey: 'setUpOrganization',
          bindings: { organizationId: org.id },
          returnUrl,
        }),
      );
      expect(response.status).toBe(400);
    }
  });

  it('reading a flow never advances it, even when the rule now holds', async () => {
    const { organization, app } = await freshOrganization();
    const flow = await started(app, organization.id);
    await sendInvite(organization);

    const response = await app.fetch(get(`/api/v1/flow/${flow.id}`));

    expect((await json<FlowResponse>(response)).data.currentStep).toBe(0);
    expect((await app.db.flow.findUniqueOrThrow({ where: { id: flow.id } })).currentStep).toBe(0);
  });

  it('cancels and returns the returnUrl; a canceled flow never advances', async () => {
    const { organization, app } = await freshOrganization();
    const flow = await started(app, organization.id);

    const canceled = await app.fetch(post(`/api/v1/flow/${flow.id}/cancel`));
    const { data } = await json<FlowResponse>(canceled);
    expect(canceled.status).toBe(200);
    expect(data.returnUrl).toBe('/dashboard');
    expect(data.canceledAt).not.toBeNull();

    const again = await app.fetch(post(`/api/v1/flow/${flow.id}/cancel`));
    expect((await json<FlowResponse>(again)).data.canceledAt).toBe(data.canceledAt);

    await sendInvite(organization);
    const checked = await checkIn(app, flow.id);
    expect(checked.currentStep).toBe(0);
    expect(checked.completedAt).toBeNull();
  });

  it('two concurrent checks record each completed step once', async () => {
    const { organization, app } = await freshOrganization();
    const flow = await started(app, organization.id);
    await sendInvite(organization);

    const responses = await Promise.all([
      app.fetch(post(`/api/v1/flow/${flow.id}/check`)),
      app.fetch(post(`/api/v1/flow/${flow.id}/check`)),
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const stored = await app.db.flow.findUniqueOrThrow({ where: { id: flow.id } });
    expect(stored.currentStep).toBe(1);
    expect(stored.completedSteps).toHaveLength(1);
  });

  it("a stale or foreign flow id is not found or not the user's", async () => {
    const { entity: othersFlow } = await createFlowRow({ bindings: { organizationId: org.id } });

    expect((await harness.fetch(get(`/api/v1/flow/${othersFlow.id}`))).status).toBe(403);
    expect((await harness.fetch(post(`/api/v1/flow/${othersFlow.id}/check`))).status).toBe(403);
    expect((await harness.fetch(post(`/api/v1/flow/${othersFlow.id}/cancel`))).status).toBe(403);
    expect(
      (await harness.fetch(get('/api/v1/flow/01a12b8e-0000-7000-8000-000000000000'))).status,
    ).toBe(404);
  });
});
