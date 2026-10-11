/**
 * @atlas
 * @kind test
 * @partOf primitive:flows
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { buildFlow, buildFlowStep, buildUser } from '@template/db/test';
import { FlowBanner } from '@template/ui/components/flows/FlowBanner';
import { FlowProvider } from '@template/ui/components/flows/FlowProvider';
import { Button } from '@template/ui/components/primitives/Button';
import { Form } from '@template/ui/components/primitives/Form';
import { Link } from '@template/ui/components/primitives/Link';
import { useStartFlow } from '@template/ui/hooks/flow/useStartFlow';
import type { Flow } from '@template/ui/lib/flows/flowTypes';
import { useAppStore } from '@template/ui/store';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

const initialState = useAppStore.getState();

let flow: Flow;
let requests: Array<{ method: string; path: string; body: unknown }>;
let fetchSpy: ReturnType<typeof spyOn<typeof globalThis, 'fetch'>>;
let client: QueryClient;
let navigatePreserving: ReturnType<typeof mock>;

const buildServerFlow = async (): Promise<Flow> => {
  const { entity: user } = await buildUser();
  const { entity: flowRow } = await buildFlow(
    { returnUrl: '/archives', currentStep: 0, completedAt: null, canceledAt: null },
    { user },
  );
  const flowSteps = await Promise.all(
    [
      { label: 'Connect Railway', url: '/settings/integrations?connect=railway' },
      { label: 'Provision', url: '/archives?provision=1' },
    ].map(async (step, order) => {
      const { entity } = await buildFlowStep(
        { ...step, order, flowId: flowRow.id, data: {}, completedAt: null },
        { flow: flowRow },
      );
      return { ...entity.__serialize(), data: {} };
    }),
  );
  return { ...flowRow.__serialize(), flowSteps };
};

const advanced = (current: Flow): Flow => {
  const completedAt = new Date().toISOString();
  const currentStep = current.currentStep + 1;
  return {
    ...current,
    currentStep,
    completedAt: currentStep === current.flowSteps.length ? completedAt : null,
    flowSteps: current.flowSteps.map((step) =>
      step.order === current.currentStep ? { ...step, completedAt } : step,
    ),
  };
};

const flowRequests = () => requests.filter((request) => request.path.startsWith('/api/v1/flow/'));
const advanceRequests = () => flowRequests().filter((request) => request.path.endsWith('/advance'));

const renderAt = (entry: string, ui: ReactNode) => {
  const root = createRootRoute({
    component: () => (
      <FlowProvider>
        <FlowBanner />
        {ui}
      </FlowProvider>
    ),
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
};

const renderInFlow = async (ui: ReactNode, search = '') => {
  const view = renderAt(`/?flow=${flow.id}${search}`, ui);
  await screen.findByText(`Step ${flow.currentStep + 1} of ${flow.flowSteps.length}`);
  return view;
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(async () => {
  flow = await buildServerFlow();
  requests = [];
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  navigatePreserving = mock(() => {});
  const intercept = async (input: RequestInfo | URL) => {
    const request = input as Request;
    const path = new URL(request.url).pathname;
    const body = request.method === 'POST' ? await request.json().catch(() => null) : null;
    requests.push({ method: request.method, path, body });
    if (request.method === 'POST' && path === '/api/v1/me/flows')
      return Response.json({ data: flow }, { status: 201 });
    if (request.method === 'GET' && path === `/api/v1/flow/${flow.id}`)
      return Response.json({ data: flow });
    if (request.method === 'POST' && path === `/api/v1/flow/${flow.id}/advance`) {
      flow = advanced(flow);
      return Response.json({ data: flow });
    }
    if (request.method === 'POST' && path === `/api/v1/flow/${flow.id}/cancel`) {
      flow = { ...flow, canceledAt: new Date().toISOString() };
      return Response.json({ data: flow });
    }
    return Response.json({ message: 'Unexpected request' }, { status: 400 });
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
});

describe('flow-aware Button', () => {
  it('a primary button inside a flow advances and navigates to the next step after its action succeeds', async () => {
    const action = mock(async () => {});
    await renderInFlow(<Button onClick={action}>Connect</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(navigatePreserving).toHaveBeenCalledWith(
        `/archives?provision=1&flow=${flow.id}`,
        'context',
      ),
    );
    expect(action).toHaveBeenCalledTimes(1);
    expect(advanceRequests().map((request) => request.body)).toEqual([{ currentStep: 0 }]);
    await screen.findByText('Step 2 of 2');
  });

  it('finishing the last step returns to the returnUrl without the flow', async () => {
    flow = advanced(flow);
    await renderInFlow(<Button onClick={async () => {}}>Provision</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Provision' }));

    await waitFor(() => expect(navigatePreserving).toHaveBeenCalledWith('/archives', 'context'));
    expect(advanceRequests().map((request) => request.body)).toEqual([{ currentStep: 1 }]);
  });

  it('a failing action does not advance', async () => {
    const action = mock(async () => {
      throw new Error('connect failed');
    });
    await renderInFlow(<Button onClick={action}>Connect</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(advanceRequests()).toEqual([]);
    expect(navigatePreserving).not.toHaveBeenCalled();
    expect(screen.getByText('Step 1 of 2')).toBeTruthy();
  });

  it('flow={false} exempts a primary button', async () => {
    const action = mock(async () => {});
    await renderInFlow(
      <Button flow={false} onClick={action}>
        Save draft
      </Button>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(advanceRequests()).toEqual([]);
    expect(navigatePreserving).not.toHaveBeenCalled();
  });

  it('secondary, ghost, outline and link buttons are neutral', async () => {
    const action = mock(async () => {});
    await renderInFlow(
      <>
        <Button variant="secondary" onClick={action}>
          Secondary
        </Button>
        <Button variant="ghost" onClick={action}>
          Ghost
        </Button>
        <Button variant="outline" onClick={action}>
          Outline
        </Button>
        <Button variant="link" onClick={action}>
          Link
        </Button>
      </>,
    );

    for (const name of ['Secondary', 'Ghost', 'Outline', 'Link'])
      fireEvent.click(screen.getByRole('button', { name }));
    await settle();

    expect(action).toHaveBeenCalledTimes(4);
    expect(advanceRequests()).toEqual([]);
  });

  it('flow="complete" opts a neutral variant in', async () => {
    await renderInFlow(
      <Button variant="outline" flow="complete" onClick={async () => {}}>
        Skip ahead
      </Button>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Skip ahead' }));

    await waitFor(() => expect(advanceRequests()).toHaveLength(1));
  });

  it('a synchronous handler (opening a modal) never advances', async () => {
    const openModal = mock(() => {});
    await renderInFlow(<Button onClick={openModal}>Open</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await settle();

    expect(openModal).toHaveBeenCalledTimes(1);
    expect(advanceRequests()).toEqual([]);
  });

  it('a double click advances the current step once', async () => {
    await renderInFlow(<Button onClick={async () => {}}>Connect</Button>);

    const button = screen.getByRole('button', { name: 'Connect' });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => expect(navigatePreserving).toHaveBeenCalled());
    expect(advanceRequests()).toHaveLength(1);
  });

  it('outside any flow, buttons behave exactly as before', async () => {
    const action = mock(async () => {});
    renderAt('/', <Button onClick={action}>Connect</Button>);

    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(flowRequests()).toEqual([]);
    expect(navigatePreserving).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Flow progress' })).toBeNull();
  });

  it('without a FlowProvider, a button needs no router or query client', () => {
    const action = mock(() => {});
    render(<Button onClick={action}>Plain</Button>);

    fireEvent.click(screen.getByRole('button', { name: 'Plain' }));

    expect(action).toHaveBeenCalledTimes(1);
  });
});

describe('flow-aware Form', () => {
  it('a submit that resolves advances the flow', async () => {
    await renderInFlow(
      <Form onSubmit={async (event) => event.preventDefault()}>
        <Button type="submit">Connect</Button>
      </Form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));

    await waitFor(() =>
      expect(navigatePreserving).toHaveBeenCalledWith(
        `/archives?provision=1&flow=${flow.id}`,
        'context',
      ),
    );
    expect(advanceRequests()).toHaveLength(1);
  });

  it('a submit from an exempt button does not advance', async () => {
    await renderInFlow(
      <Form onSubmit={async (event) => event.preventDefault()}>
        <Button type="submit" flow={false}>
          Save draft
        </Button>
      </Form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await settle();

    expect(advanceRequests()).toEqual([]);
  });

  it('a synchronous submit handler does not advance', async () => {
    const submit = mock((event: { preventDefault: () => void }) => event.preventDefault());
    await renderInFlow(
      <Form onSubmit={submit}>
        <Button type="submit">Connect</Button>
      </Form>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await settle();

    expect(submit).toHaveBeenCalledTimes(1);
    expect(advanceRequests()).toEqual([]);
  });
});

describe('FlowBanner', () => {
  it('shows the step label and progress, and Cancel returns to the returnUrl', async () => {
    await renderInFlow(<div />);

    expect(screen.getByText('Connect Railway')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('2');

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(navigatePreserving).toHaveBeenCalledWith('/archives', 'context'));
    expect(flowRequests().map((request) => request.path)).toContain(
      `/api/v1/flow/${flow.id}/cancel`,
    );
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Flow progress' })).toBeNull());
  });
});

describe('a stale or foreign flow id', () => {
  it('shows no banner, makes buttons neutral, and Links drop the param', async () => {
    const action = mock(async () => {});
    renderAt(
      '/?flow=01a12b8e-0000-7000-8000-000000000000',
      <>
        <Button onClick={action}>Connect</Button>
        <Link to="/settings">Settings</Link>
      </>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }));
    await settle();

    expect(action).toHaveBeenCalledTimes(1);
    expect(advanceRequests()).toEqual([]);
    expect(screen.queryByRole('region', { name: 'Flow progress' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings');
  });
});

describe('Link', () => {
  it('keeps the flow param and context; flow={false} drops the flow', async () => {
    await renderInFlow(
      <>
        <Link to="/settings/integrations">Integrations</Link>
        <Link to="/dashboard" flow={false}>
          Dashboard
        </Link>
      </>,
      '&org=org-1',
    );

    const keeps = new URL(
      screen.getByRole('link', { name: 'Integrations' }).getAttribute('href')!,
      'http://localhost',
    );
    expect(keeps.pathname).toBe('/settings/integrations');
    expect(keeps.searchParams.get('flow')).toBe(flow.id);
    expect(keeps.searchParams.get('org')).toBe('org-1');

    const drops = new URL(
      screen.getByRole('link', { name: 'Dashboard' }).getAttribute('href')!,
      'http://localhost',
    );
    expect(drops.searchParams.get('flow')).toBeNull();
    expect(drops.searchParams.get('org')).toBe('org-1');

    fireEvent.click(screen.getByRole('link', { name: 'Integrations' }));
    expect(navigatePreserving).toHaveBeenCalledWith('/settings/integrations', 'flow');
  });
});

describe('useStartFlow', () => {
  const Starter = () => {
    const { startFlow } = useStartFlow();
    return (
      <Button
        onClick={() =>
          startFlow({
            returnUrl: '/archives',
            flowSteps: flow.flowSteps.map(({ label, url }) => ({ label, url })),
          })
        }
      >
        Provision
      </Button>
    );
  };

  it('creates the flow and opens its first step carrying the flow param', async () => {
    renderAt('/archives', <Starter />);

    fireEvent.click(await screen.findByRole('button', { name: 'Provision' }));

    await waitFor(() =>
      expect(navigatePreserving).toHaveBeenCalledWith(
        `/settings/integrations?connect=railway&flow=${flow.id}`,
        'context',
      ),
    );
    const created = requests.find((request) => request.path === '/api/v1/me/flows');
    expect(created?.body).toEqual({
      returnUrl: '/archives',
      flowSteps: [
        { label: 'Connect Railway', url: '/settings/integrations?connect=railway' },
        { label: 'Provision', url: '/archives?provision=1' },
      ],
    });
  });
});
