/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildInquiry, buildUser } from '@template/db/test';
import type { InquiryItem } from '@template/sdk';
import { InquiryTargetControls } from '@template/ui/components/inquiries/InquiryTargetControls';
import '@template/ui/lib/inquiries/registrations';
import { useAppStore } from '@template/ui/store';
import { cleanup, render, screen } from '@testing-library/react';

const initialState = useAppStore.getState();

const renderControlsFor = async (type: 'mergeUser' | 'transferSpace') => {
  const { entity: sourceUser } = await buildUser();
  const { entity: targetUser } = await buildUser();
  const { entity: inquiry } = await buildInquiry({
    type,
    sourceModel: 'User',
    sourceUserId: sourceUser.id,
    targetModel: 'User',
    targetUserId: targetUser.id,
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InquiryTargetControls inquiry={inquiry.__serialize() as InquiryItem} />
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  useAppStore.setState((state) => ({
    permissions: { ...state.permissions, check: () => true },
  }));
});

afterEach(() => {
  cleanup();
  useAppStore.setState(initialState, true);
});

describe('InquiryTargetControls', () => {
  it('offers only Review for a type that approves only in review', async () => {
    await renderControlsFor('mergeUser');

    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Decline' })).not.toBeNull();
  });

  it('offers Approve beside Review for a type that can approve without one', async () => {
    await renderControlsFor('transferSpace');

    expect(screen.queryByRole('button', { name: 'Review' })).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeNull();
  });
});
