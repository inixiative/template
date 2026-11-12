/**
 * @atlas
 * @kind test
 * @partOf primitive:flows
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClientProvider, useMutation } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import type { Flow } from '@template/sdk';
import { FlowStepAdvance, FlowStepState } from '@template/shared/flows';
import { FlowBanner } from '@template/ui/components/flows/FlowBanner';
import { Modal } from '@template/ui/components/layout/Modal';
import type { NavConfig } from '@template/ui/components/layout/navigationTypes';
import { Button } from '@template/ui/components/primitives/Button';
import { type StartedFlow, useStartFlow } from '@template/ui/hooks/flow/useStartFlow';
import { useAuthenticatedRouting } from '@template/ui/hooks/useAuthenticatedRouting';
import { useRegisterNavigation } from '@template/ui/hooks/useRegisterNavigation';
import { createAppQueryClient } from '@template/ui/lib/createAppQueryClient';
import { toast } from '@template/ui/lib/toast';
import { useAppStore } from '@template/ui/store';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const ORG = '01a12b8e-1111-7000-8000-000000000001';
const FLOW_ID = '01a12b8e-2222-7000-8000-000000000002';

const tokensPage = `/settings/tokens?org=${ORG}#create-token`;
const step = (key: string, label: string, to: string, advance: FlowStepAdvance) => ({
  key,
  label,
  to,
  advance,
  readPath: '/api/v1/organization/x/tokens',
  rule: {},
});
const steps: Flow['steps'] = [
  step(
    'inviteTeammate',
    'Invite a teammate',
    `/users/members?org=${ORG}#invite`,
    FlowStepAdvance.auto,
  ),
  step('createCiToken', 'Create an API token for CI', tokensPage, FlowStepAdvance.confirm),
  step('createLocalToken', 'Create one for local development', tokensPage, FlowStepAdvance.confirm),
];

const navConfig: NavConfig = {
  user: [],
  organization: [],
  space: [],
  public: ['/users/members', '/settings/tokens', '/settings', '/elsewhere', '/dashboard'].map(
    (path) => ({ label: path, path }),
  ),
};

const initialState = useAppStore.getState();

let holding: number;
let gone: boolean;
let requests: Array<{ method: string; path: string }>;
let started: StartedFlow | undefined;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;

const serverFlow = (): Flow => {
  const currentStep = Math.min(holding, steps.length);
  return {
    id: FLOW_ID,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: '01a12b8e-3333-7000-8000-000000000003',
    flowKey: 'setUpOrganization',
    steps,
    returnUrl: '/settings',
    currentStep,
    stepStates: steps.map((_, index) =>
      index < currentStep ? FlowStepState.done : FlowStepState.pending,
    ),
  };
};

const flowReads = () =>
  requests.filter(({ method, path }) => method === 'GET' && path === `/api/v1/flow/${FLOW_ID}`);

const Work = () => {
  const { mutate } = useMutation({
    mutationFn: async () => {
      await fetch(new Request('http://localhost:8000/api/v1/work', { method: 'POST' }));
    },
    throwOnError: false,
  });
  return (
    <Button variant="ghost" onClick={() => mutate()}>
      Do work
    </Button>
  );
};

let withModal: boolean;

const Starter = () => {
  const { mutateAsync } = useStartFlow();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        started = await mutateAsync({
          flowKey: 'setUpOrganization',
          bindings: { organizationId: ORG },
        });
      }}
    >
      Start
    </Button>
  );
};

const Root = () => {
  useRegisterNavigation(navConfig);
  useAuthenticatedRouting();
  return (
    <>
      <FlowBanner />
      <Work />
      <Starter />
      {withModal && (
        <Modal isOpen onClose={() => undefined} title="Your key">
          key
        </Modal>
      )}
    </>
  );
};

const renderAt = (entry: string) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: Root }),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(
    <QueryClientProvider client={createAppQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

const renderInFlow = async (pathname = '/users/members') => {
  const router = renderAt(`${pathname}?org=${ORG}&flow=${FLOW_ID}`);
  await screen.findByText(`Step ${Math.min(holding, steps.length) + 1} of ${steps.length}`);
  return router;
};

const doWork = async () => {
  const before = flowReads().length;
  fireEvent.click(screen.getByRole('button', { name: 'Do work' }));
  await waitFor(() => expect(flowReads().length).toBe(before + 1));
};

beforeEach(() => {
  holding = 0;
  withModal = false;
  started = undefined;
  gone = false;
  requests = [];
  const intercept = async (input: RequestInfo | URL) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    requests.push({ method: request.method, path });
    if (path === '/api/v1/work') return Response.json({ data: {} });
    if (path === '/api/v1/me/flows') return Response.json({ data: serverFlow() }, { status: 201 });
    if (path === `/api/v1/flow/${FLOW_ID}` && request.method === 'DELETE') {
      gone = true;
      return new Response(null, { status: 204 });
    }
    if (path === `/api/v1/flow/${FLOW_ID}` && !gone) {
      const flow = serverFlow();
      if (flow.currentStep === steps.length) gone = true;
      return Response.json({ data: flow });
    }
    return Response.json({ message: 'Flow ended' }, { status: 404 });
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
  useAppStore.setState((state) => ({ auth: { ...state.auth, isAuthenticated: true } }));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  useAppStore.setState(initialState);
});

describe('flow client', () => {
  it('is seeded from ?flow= and kept across navigatePreserving', async () => {
    const router = await renderInFlow();
    expect(useAppStore.getState().navigation.flowId).toBe(FLOW_ID);

    act(() => useAppStore.getState().navigation.navigatePreserving('/settings/tokens', 'context'));

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/tokens'));
    expect(router.state.location.search).toMatchObject({ flow: FLOW_ID });
  });

  it('rechecks after any mutation and moves on by itself after an auto step', async () => {
    const router = await renderInFlow();

    holding = 1;
    await doWork();

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/tokens'));
    expect(router.state.location.hash).toBe('create-token');
    expect(router.state.location.search).toMatchObject({ org: ORG, flow: FLOW_ID });
  });

  it('stays put after a confirm step whose next step lives on the same page', async () => {
    holding = 1;
    const router = await renderInFlow('/settings/tokens');

    holding = 2;
    await doWork();

    await screen.findByText('Step 3 of 3');
    expect(router.state.location.pathname).toBe('/settings/tokens');
    expect(screen.queryByRole('button', { name: /^Continue/ })).toBeNull();
  });

  it('turns an open modal close into Continue while the current step lives elsewhere', async () => {
    holding = 1;
    withModal = true;
    const router = await renderInFlow();

    const next = await screen.findAllByRole('button', {
      name: 'Continue: Create an API token for CI',
    });
    expect(next).toHaveLength(2);
    fireEvent.click(next[1]!);

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/tokens'));
    expect(router.state.location.hash).toBe('create-token');
  });

  it('finishes on returnUrl once the last step is confirmed', async () => {
    holding = 2;
    const router = await renderInFlow('/settings/tokens');

    holding = 3;
    await doWork();
    fireEvent.click(await screen.findByRole('button', { name: 'Finish' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'));
    expect(useAppStore.getState().navigation.flowId).toBeNull();
    expect(router.state.location.search).not.toHaveProperty('flow');
    expect(screen.queryByLabelText('Setup guide')).toBeNull();
  });

  it('starting a flow goes to its first pending step', async () => {
    holding = 1;
    const router = renderAt('/dashboard');

    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/tokens'));
    expect(started?.started).toBe(true);
    expect(useAppStore.getState().navigation.flowId).toBe(FLOW_ID);
  });

  it('starting a flow that already holds leaves the caller where it is', async () => {
    holding = 3;
    const router = renderAt('/dashboard');

    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

    await waitFor(() => expect(started?.started).toBe(false));
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(useAppStore.getState().navigation.flowId).toBeNull();
  });

  it('drops the flow when the user leaves its pages', async () => {
    await renderInFlow();

    act(() => useAppStore.getState().navigation.navigatePreserving('/elsewhere', 'context'));

    await waitFor(() => expect(useAppStore.getState().navigation.flowId).toBeNull());
    await waitFor(() =>
      expect(requests).toContainEqual({ method: 'DELETE', path: `/api/v1/flow/${FLOW_ID}` }),
    );
  });

  it('clears quietly when the flow read answers 404', async () => {
    const message = spyOn(toast, 'message');
    const error = spyOn(toast, 'error');
    await renderInFlow();

    gone = true;
    await doWork();

    await waitFor(() => expect(useAppStore.getState().navigation.flowId).toBeNull());
    expect(message).toHaveBeenCalledWith('Setup guide ended');
    expect(error).not.toHaveBeenCalled();
    message.mockRestore();
    error.mockRestore();
  });
});
