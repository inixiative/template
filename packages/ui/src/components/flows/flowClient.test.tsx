/**
 * @atlas
 * @kind test
 * @partOf primitive:flows
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider, useMutation } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { buildFlow, buildUser } from '@template/db/test';
import { FlowBanner } from '@template/ui/components/flows/FlowBanner';
import { FlowProvider } from '@template/ui/components/flows/FlowProvider';
import { Button } from '@template/ui/components/primitives/Button';
import { Link } from '@template/ui/components/primitives/Link';
import { useStartFlow } from '@template/ui/hooks/flow/useStartFlow';
import type { Flow } from '@template/ui/lib/flows/flowTypes';
import { useAppStore } from '@template/ui/store';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const ORG = '01a12b8e-1111-7000-8000-000000000001';
const STEPS = [
  { key: 'inviteTeammate', label: 'Invite a teammate', mode: 'navigate', required: 1 },
  { key: 'inviteAnother', label: 'Invite one more', mode: 'anchor', required: 2 },
  { key: 'confirmHere', label: 'Confirm on this page', mode: 'action', required: 1 },
  { key: 'createApiTokens', label: 'Create two API tokens', mode: 'navigate', required: 2 },
] as const;
const STEP_URLS = [
  `/users/members?org=${ORG}`,
  `/users/members?org=${ORG}#invite`,
  `/users/members?org=${ORG}`,
  `/settings/tokens?org=${ORG}#create-token`,
];

const initialState = useAppStore.getState();
const initialLocation = window.location.href;

let flow: Flow;
let rows: number;
let requests: Array<{ method: string; path: string }>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let navigatePreserving: ReturnType<typeof mock>;

const progressOf = (current: Flow) => {
  const step = STEPS[current.currentStep];
  return step && !current.completedAt && !current.canceledAt
    ? { count: rows, required: step.required }
    : null;
};

const serverCheck = (current: Flow): Flow => {
  let next = current;
  for (;;) {
    const step = STEPS[next.currentStep];
    if (!step || next.completedAt || next.canceledAt || rows < step.required) break;
    rows -= step.required;
    const completedAt = new Date().toISOString();
    const currentStep = next.currentStep + 1;
    next = {
      ...next,
      currentStep,
      completedAt: currentStep === STEPS.length ? completedAt : null,
      flowSteps: next.flowSteps.map((flowStep) =>
        flowStep.key === step.key ? { ...flowStep, completedAt } : flowStep,
      ),
    };
  }
  return { ...next, progress: progressOf(next) };
};

const buildServerFlow = async (): Promise<Flow> => {
  const { entity: user } = await buildUser();
  const { entity } = await buildFlow(
    {
      flowKey: 'setUpOrganization',
      params: { organizationId: ORG },
      returnUrl: '/dashboard',
      currentStep: 0,
      completedSteps: [],
      completedAt: null,
      canceledAt: null,
    },
    { user },
  );
  const { completedSteps: _completedSteps, ...row } = entity.__serialize();
  const started = {
    ...row,
    params: { organizationId: ORG },
    flowSteps: STEPS.map(({ key, label, mode }, index) => ({
      key,
      label,
      mode,
      url: STEP_URLS[index]!,
      completedAt: null,
    })),
    progress: null,
  };
  return { ...started, progress: { count: 0, required: 1 } };
};

const flowRequests = (suffix: string) =>
  requests.filter((request) => request.path === `/api/v1/flow/${flow.id}${suffix}`);

const Work = ({ path = '/api/v1/work', label = 'Do work' }: { path?: string; label?: string }) => {
  const { mutate } = useMutation({
    mutationFn: async () => {
      const response = await fetch(new Request(`http://localhost:8000${path}`, { method: 'POST' }));
      if (!response.ok) throw new Error('work failed');
    },
    throwOnError: false,
    meta: { skipErrorToast: true },
  });
  return (
    <Button variant="ghost" onClick={() => mutate()}>
      {label}
    </Button>
  );
};

const renderAt = (entry: string, ui: ReactNode) => {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <FlowProvider>
          <FlowBanner />
          {ui}
        </FlowProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
};

const renderInFlow = async (ui: ReactNode = <Work />) => {
  const router = renderAt(`/users/members?org=${ORG}&flow=${flow.id}`, ui);
  await screen.findByText(`Step ${flow.currentStep + 1} of ${STEPS.length}`);
  return router;
};

const doWork = async (label = 'Do work') => {
  const before = flowRequests('/check').length;
  fireEvent.click(screen.getByRole('button', { name: label }));
  await waitFor(() => expect(flowRequests('/check').length).toBe(before + 1));
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

beforeEach(async () => {
  flow = await buildServerFlow();
  rows = 0;
  requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  navigatePreserving = mock(() => {});
  const intercept = async (input: RequestInfo | URL) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    requests.push({ method: request.method, path });
    if (request.method === 'POST' && path === '/api/v1/work') {
      rows += 1;
      return Response.json({ data: {} });
    }
    if (request.method === 'POST' && path === '/api/v1/fail')
      return Response.json({ message: 'nope' }, { status: 400 });
    if (request.method === 'POST' && path === '/api/v1/me/flows')
      return Response.json({ data: flow }, { status: 201 });
    if (request.method === 'GET' && path === `/api/v1/flow/${flow.id}`)
      return Response.json({ data: flow });
    if (request.method === 'POST' && path === `/api/v1/flow/${flow.id}/check`) {
      flow = serverCheck(flow);
      return Response.json({ data: flow });
    }
    if (request.method === 'POST' && path === `/api/v1/flow/${flow.id}/cancel`) {
      flow = { ...flow, canceledAt: new Date().toISOString(), progress: null };
      return Response.json({ data: flow });
    }
    return Response.json({ message: 'Unexpected request' }, { status: 404 });
  };
  fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
    Object.assign(intercept, { preconnect: fetch.preconnect }),
  );
  useAppStore.setState((state) => ({
    navigation: { ...state.navigation, navigatePreserving },
  }));
});

afterEach(() => {
  cleanup();
  fetchSpy.mockRestore();
  useAppStore.setState(initialState);
  client.clear();
  window.history.replaceState(null, '', initialLocation);
});

describe('flow client', () => {
  it('start → rule false, no advance → work → check → advance → … → complete → returnUrl', async () => {
    const Starter = () => {
      const { startFlow } = useStartFlow();
      return (
        <Button
          variant="ghost"
          onClick={() =>
            void startFlow({
              flowKey: 'setUpOrganization',
              params: { organizationId: ORG },
              returnUrl: '/dashboard',
            })
          }
        >
          Set up
        </Button>
      );
    };
    renderAt('/organizations', <Starter />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set up' }));
    await waitFor(() =>
      expect(navigatePreserving).toHaveBeenCalledWith(
        `/users/members?org=${ORG}&flow=${flow.id}`,
        'context',
      ),
    );
    cleanup();
    navigatePreserving.mockClear();

    await renderInFlow(
      <>
        <Work />
        <Work path="/api/v1/fail" label="Fail" />
      </>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    await settle();
    expect(flowRequests('/check')).toHaveLength(0);

    await doWork();
    await waitFor(() =>
      expect(navigatePreserving).toHaveBeenCalledWith(
        `/users/members?org=${ORG}&flow=${flow.id}#invite`,
        'context',
      ),
    );
    await screen.findByText('Step 2 of 4');

    await doWork();
    await screen.findByText('1 of 2');
    expect(screen.getByText('Step 2 of 4')).toBeTruthy();

    navigatePreserving.mockClear();
    await doWork();
    await screen.findByText('Step 3 of 4');
    expect(navigatePreserving).not.toHaveBeenCalled();

    await doWork();
    await screen.findByText('Step 4 of 4');
    expect(navigatePreserving).toHaveBeenCalledWith(
      `/settings/tokens?org=${ORG}&flow=${flow.id}#create-token`,
      'context',
    );

    await doWork();
    await doWork();
    await waitFor(() => expect(navigatePreserving).toHaveBeenCalledWith('/dashboard', 'context'));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Flow progress' })).toBeNull());
  });

  it('a two-action step advances only after both actions', async () => {
    flow = { ...flow, currentStep: 1, progress: { count: 0, required: 2 } };
    await renderInFlow();

    await doWork();
    await screen.findByText('1 of 2');
    expect(navigatePreserving).not.toHaveBeenCalled();

    await doWork();
    await screen.findByText('Step 3 of 4');
  });

  it('an anchor step keeps the page and sets the hash', async () => {
    await renderInFlow();

    await doWork();

    await waitFor(() => expect(navigatePreserving).toHaveBeenCalledTimes(1));
    const [target] = navigatePreserving.mock.calls[0] as unknown as [string];
    const url = new URL(target, 'http://localhost');
    expect(url.pathname).toBe('/users/members');
    expect(url.hash).toBe('#invite');
    expect(url.searchParams.get('flow')).toBe(flow.id);
  });

  it('Back, forward and clicking around never check or advance', async () => {
    rows = 5;
    const router = await renderInFlow(<Link to="/settings/tokens">Tokens</Link>);

    await act(async () => {
      await router.navigate({ to: '/settings/tokens', search: { flow: flow.id } as never });
    });
    await act(async () => {
      router.history.back();
    });
    await act(async () => {
      router.history.forward();
    });
    fireEvent.click(screen.getByRole('link', { name: 'Tokens' }));
    await settle();

    expect(flowRequests('/check')).toHaveLength(0);
    expect(screen.getByText('Step 1 of 4')).toBeTruthy();
  });

  it("the flow's own requests never trigger a check", async () => {
    await renderInFlow();

    await doWork();
    await settle();

    expect(flowRequests('/check')).toHaveLength(1);
  });

  it('Cancel returns to the returnUrl', async () => {
    await renderInFlow();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(navigatePreserving).toHaveBeenCalledWith('/dashboard', 'context'));
    expect(flowRequests('/cancel')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Flow progress' })).toBeNull());
  });

  it('a stale or foreign flow id is inert: no banner, no checks, Links drop it', async () => {
    renderAt(
      '/users/members?flow=01a12b8e-0000-7000-8000-000000000000',
      <>
        <Work />
        <Link to="/settings">Settings</Link>
      </>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Do work' }));
    await settle();

    expect(requests.filter((request) => request.path.endsWith('/check'))).toHaveLength(0);
    expect(screen.queryByRole('region', { name: 'Flow progress' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings');
  });

  it('outside any flow, a mutation never checks', async () => {
    renderAt('/users/members', <Work />);

    fireEvent.click(await screen.findByRole('button', { name: 'Do work' }));
    await settle();

    expect(requests.map((request) => request.path)).toEqual(['/api/v1/work']);
  });

  it('Link keeps the flow param and context while a flow is active', async () => {
    await renderInFlow(<Link to="/settings/tokens">Tokens</Link>);

    const href = new URL(
      screen.getByRole('link', { name: 'Tokens' }).getAttribute('href')!,
      'http://localhost',
    );
    expect(href.searchParams.get('flow')).toBe(flow.id);
    expect(href.searchParams.get('org')).toBe(ORG);
  });
});
