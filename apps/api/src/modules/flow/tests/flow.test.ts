import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { Flow, FlowStep, User } from '@template/db/generated/client/client';
import {
  cleanupTouchedTables,
  createFlow as createFlowRow,
  createFlowStep,
  createToken,
  createUser,
} from '@template/db/test';
import { registerImmutableFieldsHook } from '#/hooks/immutableFields/hook';
import { flowRouter } from '#/modules/flow';
import { meRouter } from '#/modules/me';
import { createTestApp } from '#tests/createTestApp';
import { get, json, jsonError, post } from '#tests/utils/request';

registerImmutableFieldsHook();

type FlowResponse = Flow & { flowSteps: FlowStep[] };

const flowSteps = [
  { label: 'Connect Railway', url: '/settings/integrations?connect=railway' },
  { label: 'Pick a workspace', url: '/settings/integrations/workspaces' },
  { label: 'Provision', url: '/archives?provision=1', data: { provider: 'railway' } },
];

describe('flows', () => {
  let fetch: ReturnType<typeof createTestApp>['fetch'];
  let db: ReturnType<typeof createTestApp>['db'];
  let user: User;

  beforeAll(async () => {
    user = (await createUser()).entity;
    const harness = createTestApp({
      mockUser: user,
      mount: [
        (app) => app.route('/api/v1/me', meRouter),
        (app) => app.route('/api/v1/flow', flowRouter),
      ],
    });
    fetch = harness.fetch;
    db = harness.db;
  });

  afterAll(async () => {
    await cleanupTouchedTables(db);
  });

  const startFlow = async (body: unknown = { returnUrl: '/archives', flowSteps }) => {
    const response = await fetch(post('/api/v1/me/flows', body));
    expect(response.status).toBe(201);
    return (await json<FlowResponse>(response)).data;
  };

  const advance = (flowId: string, currentStep: number) =>
    fetch(post(`/api/v1/flow/${flowId}/advance`, { currentStep }));

  const createOtherUsersFlow = async () => {
    const { entity: flow, context } = await createFlowRow();
    await createFlowStep({ order: 0 }, context);
    return flow;
  };

  it('creates, reads, advances through every step, and completes', async () => {
    const created = await startFlow();
    expect(created.userId).toBe(user.id);
    expect(created.currentStep).toBe(0);
    expect(created.flowSteps.map((step) => [step.order, step.label, step.url])).toEqual(
      flowSteps.map((step, order) => [order, step.label, step.url]),
    );
    expect(created.flowSteps[2]!.data).toEqual({ provider: 'railway' });

    const read = await fetch(get(`/api/v1/flow/${created.id}`));
    expect(read.status).toBe(200);
    expect((await json<FlowResponse>(read)).data.flowSteps).toHaveLength(3);

    for (const step of [0, 1]) {
      const response = await advance(created.id, step);
      const { data } = await json<FlowResponse>(response);
      expect(response.status).toBe(200);
      expect(data.currentStep).toBe(step + 1);
      expect(data.completedAt).toBeNull();
      expect(data.flowSteps[step]!.completedAt).not.toBeNull();
    }

    const last = await advance(created.id, 2);
    const { data: completed } = await json<FlowResponse>(last);
    expect(last.status).toBe(200);
    expect(completed.currentStep).toBe(3);
    expect(completed.completedAt).not.toBeNull();
    expect(completed.flowSteps.every((step) => step.completedAt !== null)).toBe(true);
  });

  it('refuses to advance past the end', async () => {
    const created = await startFlow({
      returnUrl: '/archives',
      flowSteps: [{ label: 'Only', url: '/only' }],
    });
    expect((await advance(created.id, 0)).status).toBe(200);

    const pastEnd = await advance(created.id, 1);
    expect(pastEnd.status).toBe(409);
    expect((await jsonError(pastEnd)).message).toBe('Flow is already complete');
  });

  it('refuses to skip a step', async () => {
    const created = await startFlow();
    const skipped = await advance(created.id, 1);
    expect(skipped.status).toBe(409);

    const reread = await db.flow.findUniqueOrThrow({ where: { id: created.id } });
    expect(reread.currentStep).toBe(0);
  });

  it('a repeated advance of a completed step returns the flow unchanged', async () => {
    const created = await startFlow();
    await advance(created.id, 0);

    const repeated = await advance(created.id, 0);
    const { data } = await json<FlowResponse>(repeated);
    expect(repeated.status).toBe(200);
    expect(data.currentStep).toBe(1);
  });

  it('advances once when the same step is advanced concurrently', async () => {
    const created = await startFlow();

    const responses = await Promise.all([advance(created.id, 0), advance(created.id, 0)]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const bodies = await Promise.all(responses.map((response) => json<FlowResponse>(response)));
    expect(bodies.map(({ data }) => data.currentStep)).toEqual([1, 1]);
    const reread = await db.flow.findUniqueOrThrow({
      where: { id: created.id },
      include: { flowSteps: true },
    });
    expect(reread.currentStep).toBe(1);
    expect(reread.flowSteps.filter((step) => step.completedAt !== null)).toHaveLength(1);
  });

  it("does not let a user read or advance another user's flow", async () => {
    const othersFlow = await createOtherUsersFlow();

    expect((await fetch(get(`/api/v1/flow/${othersFlow.id}`))).status).toBe(403);
    expect((await advance(othersFlow.id, 0)).status).toBe(403);
    expect((await fetch(post(`/api/v1/flow/${othersFlow.id}/cancel`))).status).toBe(403);

    const reread = await db.flow.findUniqueOrThrow({ where: { id: othersFlow.id } });
    expect(reread.currentStep).toBe(0);
  });

  it('cancels and returns the returnUrl; a canceled flow does not advance', async () => {
    const created = await startFlow();

    const canceled = await fetch(post(`/api/v1/flow/${created.id}/cancel`));
    const { data } = await json<FlowResponse>(canceled);
    expect(canceled.status).toBe(200);
    expect(data.returnUrl).toBe('/archives');
    expect(data.canceledAt).not.toBeNull();

    const again = await fetch(post(`/api/v1/flow/${created.id}/cancel`));
    expect(again.status).toBe(200);
    expect((await json<FlowResponse>(again)).data.canceledAt).toBe(data.canceledAt);

    const advanced = await advance(created.id, 0);
    expect(advanced.status).toBe(409);
    expect((await jsonError(advanced)).message).toBe('Flow was canceled');
  });

  it('advancing the last step and canceling concurrently leave exactly one terminal state', async () => {
    const created = await startFlow({
      returnUrl: '/archives',
      flowSteps: [{ label: 'Only', url: '/only' }],
    });

    const [advanced, canceled] = await Promise.all([
      advance(created.id, 0),
      fetch(post(`/api/v1/flow/${created.id}/cancel`)),
    ]);

    expect([advanced.status, canceled.status].sort()).toEqual([200, 409]);
    const reread = await db.flow.findUniqueOrThrow({ where: { id: created.id } });
    expect([reread.completedAt, reread.canceledAt].filter((stamp) => stamp !== null)).toHaveLength(
      1,
    );
  });

  it("a read-only token can read its user's flow but not move it", async () => {
    const created = await startFlow();
    const { entity: token } = await createToken({ ownerModel: 'User', role: 'viewer' }, { user });
    const viewer = createTestApp({
      mockUser: user,
      mockToken: {
        ...token,
        user,
        organization: null,
        organizationUser: null,
        space: null,
        spaceUser: null,
      },
      mount: [(app) => app.route('/api/v1/flow', flowRouter)],
    });

    expect((await viewer.fetch(get(`/api/v1/flow/${created.id}`))).status).toBe(200);
    const advanced = await viewer.fetch(
      post(`/api/v1/flow/${created.id}/advance`, { currentStep: 0 }),
    );
    expect(advanced.status).toBe(403);
    expect((await viewer.fetch(post(`/api/v1/flow/${created.id}/cancel`))).status).toBe(403);
  });

  it('does not cancel a completed flow', async () => {
    const created = await startFlow({
      returnUrl: '/archives',
      flowSteps: [{ label: 'Only', url: '/only' }],
    });
    await advance(created.id, 0);

    const canceled = await fetch(post(`/api/v1/flow/${created.id}/cancel`));
    expect(canceled.status).toBe(409);
  });

  it('accepts only paths inside the app for step urls and the returnUrl', async () => {
    const outside = [
      'https://evil.example/x',
      '//evil.example/x',
      '/\\evil.example',
      '/.//evil.example',
      '/\t/evil.example',
      'javascript:alert(1)',
      'relative',
    ];

    for (const url of outside) {
      const stepResponse = await fetch(
        post('/api/v1/me/flows', { returnUrl: '/archives', flowSteps: [{ label: 'X', url }] }),
      );
      expect(stepResponse.status).toBe(400);

      const returnResponse = await fetch(
        post('/api/v1/me/flows', { returnUrl: url, flowSteps: [{ label: 'X', url: '/x' }] }),
      );
      expect(returnResponse.status).toBe(400);
    }
  });

  it('refuses a flow with no steps', async () => {
    const response = await fetch(
      post('/api/v1/me/flows', { returnUrl: '/archives', flowSteps: [] }),
    );
    expect(response.status).toBe(400);
  });

  it("keeps a step's label, url and data immutable once created", async () => {
    const created = await startFlow();
    const step = created.flowSteps[0]!;

    await db.flowStep.update({
      where: { id: step.id },
      data: { label: 'Changed', url: '/changed', order: 9, data: { changed: true } },
    });

    const reread = await db.flowStep.findUniqueOrThrow({ where: { id: step.id } });
    expect([reread.label, reread.url, reread.order, reread.data]).toEqual([
      step.label,
      step.url,
      step.order,
      step.data,
    ]);
  });
});
