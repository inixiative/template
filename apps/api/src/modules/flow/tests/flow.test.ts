import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
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
import type { z } from 'zod';
import { flowRouter } from '#/modules/flow';
import type { flowResponseSchema } from '#/modules/flow/schemas/flowSchemas';
import { meRouter } from '#/modules/me';
import { organizationRouter } from '#/modules/organization';
import { createTestApp } from '#tests/createTestApp';
import { del, get, json, jsonError, post } from '#tests/utils/request';

type FlowResponse = z.infer<typeof flowResponseSchema>;

const harnessFor = (user: User, seats: OrganizationUser[]) =>
  createTestApp({
    mockUser: user,
    mockOrganizationUsers: seats,
    mount: [
      (app) => app.route('/api/v1/me', meRouter),
      (app) => app.route('/api/v1/flow', flowRouter),
      (app) => app.route('/api/v1/organization', organizationRouter),
    ],
  });

type Harness = ReturnType<typeof harnessFor>;

const sendInvite = async (organization: Organization, status: InquiryStatus) => {
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

const createOrganizationToken = async (organization: Organization, name: string) =>
  (await createToken({ name, ownerModel: TokenOwnerModel.Organization }, { organization })).entity;

describe('flows', () => {
  let owner: User;
  let harness: Harness;

  beforeAll(async () => {
    owner = (await createUser()).entity;
    harness = harnessFor(owner, []);
  });

  afterAll(async () => {
    await cleanupTouchedTables(harness.db);
  });

  const ownedOrganization = async () => {
    const { entity: organization } = await createOrganization();
    const { entity: seat } = await createOrganizationUser(
      { role: 'owner' },
      { user: owner, organization },
    );
    return { organization, seat, app: harnessFor(owner, [seat]) };
  };

  const startIn = (app: Harness, bindings: Record<string, unknown>) =>
    app.fetch(post('/api/v1/me/flows', { flowKey: 'setUpOrganization', bindings }));

  const started = async (app: Harness, organizationId: string) => {
    const response = await startIn(app, { organizationId, returnUrl: '/settings' });
    expect(response.status).toBe(201);
    return (await json<FlowResponse>(response)).data;
  };

  const readIn = async (app: Harness, flowId: string) => {
    const response = await app.fetch(get(`/api/v1/flow/${flowId}`));
    expect(response.status).toBe(200);
    return (await json<FlowResponse>(response)).data;
  };

  it('validates bindings against the registered schema', async () => {
    const response = await startIn(harness, { organizationId: 'nope' });

    expect(response.status).toBe(422);
    expect(Object.keys((await jsonError(response)).fieldErrors ?? {})).toEqual([
      'bindings.organizationId',
    ]);
    expect(
      (await startIn(harness, { organizationId: owner.id, returnUrl: 'https://evil.test' })).status,
    ).toBe(422);
  });

  it('drops a flow over an organization the caller cannot read, and stores nothing', async () => {
    const { entity: foreign } = await createOrganization();
    const response = await startIn(harness, { organizationId: foreign.id });

    expect(response.status).toBe(404);
    expect(await harness.db.flow.count({ where: { userId: owner.id } })).toBe(0);
  });

  it('resolves and stores every step at create', async () => {
    const { organization, app } = await ownedOrganization();
    const flow = await started(app, organization.id);

    expect(flow.returnUrl).toBe('/settings');
    expect(flow.currentStep).toBe(0);
    expect(flow.stepStates).toEqual(['pending', 'pending', 'pending']);
    expect(flow.steps.map(({ key, to, advance }) => [key, to, advance])).toEqual([
      ['inviteTeammate', `/users/members?org=${organization.id}#invite`, 'auto'],
      ['createCiToken', `/settings/tokens?org=${organization.id}#create-token`, 'confirm'],
      ['createLocalToken', `/settings/tokens?org=${organization.id}#create-token`, 'confirm'],
    ]);
    expect(flow.steps[0]?.readPath).toStartWith(
      `/api/v1/organization/${organization.id}/inquiries/sent?`,
    );
    expect(await harness.db.flow.findUnique({ where: { id: flow.id } })).not.toBeNull();
  });

  it('completes the invite step at create when any invite was already sent', async () => {
    const { organization, app } = await ownedOrganization();
    await sendInvite(organization, InquiryStatus.sent);

    const flow = await started(app, organization.id);

    expect(flow.currentStep).toBe(1);
    expect(flow.stepStates).toEqual(['done', 'pending', 'pending']);
  });

  it('rechecks from the first step: advances in order and goes back when a step stops holding', async () => {
    const { organization, app } = await ownedOrganization();
    const flow = await started(app, organization.id);

    await sendInvite(organization, InquiryStatus.draft);
    expect((await readIn(app, flow.id)).currentStep).toBe(0);

    await createOrganizationToken(organization, 'personal');
    expect((await readIn(app, flow.id)).currentStep).toBe(0);

    await sendInvite(organization, InquiryStatus.sent);
    const ciToken = await createOrganizationToken(organization, 'ci runner');
    const advanced = await readIn(app, flow.id);
    expect(advanced.currentStep).toBe(2);
    expect(advanced.stepStates).toEqual(['done', 'done', 'pending']);

    await harness.db.token.delete({ where: { id: ciToken.id } });
    const back = await readIn(app, flow.id);
    expect(back.currentStep).toBe(1);
    expect(back.stepStates).toEqual(['done', 'pending', 'pending']);
  });

  it('ends on the app home when no returnUrl is bound', async () => {
    const { organization, app } = await ownedOrganization();
    const response = await startIn(app, { organizationId: organization.id });

    expect((await json<FlowResponse>(response)).data.returnUrl).toBeNull();
  });

  it('returns a flow whose steps all hold at create as complete, and stores nothing', async () => {
    const { organization, app } = await ownedOrganization();
    await sendInvite(organization, InquiryStatus.sent);
    await createOrganizationToken(organization, 'ci');
    await createOrganizationToken(organization, 'local');

    const response = await startIn(app, { organizationId: organization.id });
    const flow = (await json<FlowResponse>(response)).data;

    expect(response.status).toBe(201);
    expect(flow.currentStep).toBe(3);
    expect(flow.stepStates).toEqual(['done', 'done', 'done']);
    expect(await harness.db.flow.findUnique({ where: { id: flow.id } })).toBeNull();
  });

  it('returns the finished flow once, then deletes it', async () => {
    const { organization, app } = await ownedOrganization();
    const flow = await started(app, organization.id);
    await sendInvite(organization, InquiryStatus.sent);
    await createOrganizationToken(organization, 'ci');
    await createOrganizationToken(organization, 'local');

    const finished = await readIn(app, flow.id);

    expect(finished.currentStep).toBe(3);
    expect(finished.stepStates).toEqual(['done', 'done', 'done']);
    expect(await harness.db.flow.findUnique({ where: { id: flow.id } })).toBeNull();
    expect((await app.fetch(get(`/api/v1/flow/${flow.id}`))).status).toBe(404);
  });

  it('drops the user off the flow when a step read fails', async () => {
    const { organization, app } = await ownedOrganization();
    const flow = await started(app, organization.id);

    const response = await harnessFor(owner, []).fetch(get(`/api/v1/flow/${flow.id}`));

    expect(response.status).toBe(404);
    expect(await harness.db.flow.findUnique({ where: { id: flow.id } })).toBeNull();
    expect((await app.fetch(get(`/api/v1/flow/${flow.id}`))).status).toBe(404);
  });

  it('answers 404 to the losing tab when two reads finish the flow at once', async () => {
    const { organization, app } = await ownedOrganization();
    const flow = await started(app, organization.id);
    await sendInvite(organization, InquiryStatus.sent);
    await createOrganizationToken(organization, 'ci');
    await createOrganizationToken(organization, 'local');

    const statuses = await Promise.all(
      [1, 2].map(async () => (await app.fetch(get(`/api/v1/flow/${flow.id}`))).status),
    );

    expect(statuses.sort()).toEqual([200, 404]);
  });

  it("refuses another user's flow", async () => {
    const { entity: stranger } = await createUser();
    const { entity: othersFlow } = await createFlowRow({}, { user: stranger });

    expect((await harness.fetch(get(`/api/v1/flow/${othersFlow.id}`))).status).toBe(403);
    expect((await harness.fetch(del(`/api/v1/flow/${othersFlow.id}`))).status).toBe(403);
    expect(await harness.db.flow.findUnique({ where: { id: othersFlow.id } })).not.toBeNull();
  });

  it('deletes a flow', async () => {
    const { entity: flow } = await createFlowRow({}, { user: owner });

    expect((await harness.fetch(del(`/api/v1/flow/${flow.id}`))).status).toBe(204);
    expect(await harness.db.flow.findUnique({ where: { id: flow.id } })).toBeNull();
  });
});
