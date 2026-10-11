/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, describe, expect, it } from 'bun:test';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { useHashSection } from '@template/ui/hooks/useHashSection';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const Section = () => {
  const [open, setOpen] = useHashSection('invite');
  return (
    <>
      <span>{open ? 'open' : 'closed'}</span>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Close
      </button>
    </>
  );
};

const renderAt = (entry: string) => {
  const router = createRouter({
    routeTree: createRootRoute({ component: Section }),
    history: createMemoryHistory({ initialEntries: [entry] }),
  });
  render(<RouterProvider router={router} />);
  return router;
};

afterEach(() => cleanup());

describe('useHashSection', () => {
  it('is open when the location carries its hash', async () => {
    renderAt('/users/members?org=o1#invite');
    expect(await screen.findByText('open')).toBeTruthy();
  });

  it('opens and closes by replacing the hash, keeping the path and search, without new history', async () => {
    const router = renderAt('/users/members?org=o1');
    await screen.findByText('closed');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Open' })));
    await screen.findByText('open');
    expect(router.state.location.hash).toBe('invite');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Close' })));
    await screen.findByText('closed');
    expect(router.state.location.pathname).toBe('/users/members');
    expect(router.state.location.search).toEqual({ org: 'o1' });
    expect(router.history.length).toBe(1);
  });
});
