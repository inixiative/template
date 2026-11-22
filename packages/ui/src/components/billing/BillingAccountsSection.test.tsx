/**
 * @atlas
 * @kind test
 * @partOf feature:billing
 * @uses primitive:ui
 */
import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  BillingAccountOwnerModel,
  BillingAccountSharing,
  BillingAccountStatus,
  BillingProvider,
} from '@template/db/generated/client/enums';
import { buildBillingAccount, buildOrganization, buildProject } from '@template/db/test';
import * as sdk from '@template/sdk';
import { BillingAccountsSection, BillingResourceSelector } from '@template/ui/components/billing';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const serializeAccount = async (overrides: Parameters<typeof buildBillingAccount>[0]) => {
  const { entity } = await buildBillingAccount(overrides);
  const serialized = JSON.parse(JSON.stringify(entity));
  const { externalCustomerId: _ec, externalSubscriptionId: _es, ...publicFields } = serialized;
  return publicFields as sdk.BillingAccountReadResponse['data'];
};

describe('BillingAccountsSection & BillingResourceSelector', () => {
  const spies: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    while (spies.length) spies.pop()?.mockRestore();
    cleanup();
  });

  it('renders organization accounts with default/shared badges and wires set-default, sharing, and delete', async () => {
    const { entity: org } = await buildOrganization();
    const defaultAccount = await serializeAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      name: 'Primary Corp Card',
      billingEmail: 'ap@acme.com',
      provider: BillingProvider.polar,
      status: BillingAccountStatus.active,
      isDefault: true,
      sharing: BillingAccountSharing.on,
      isShared: true,
      paymentMethodBrand: 'visa',
      paymentMethodLast4: '4242',
    });
    const backupAccount = await serializeAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      name: 'Backup Card',
      billingEmail: 'finance@acme.com',
      provider: BillingProvider.polar,
      status: BillingAccountStatus.incomplete,
      isDefault: false,
      sharing: BillingAccountSharing.inherit,
      isShared: false,
    });

    spies.push(
      spyOn(sdk, 'organizationReadManyBillingAccounts').mockResolvedValue({
        data: { data: [defaultAccount, backupAccount] },
      } as never),
    );
    const updateSpy = spyOn(sdk, 'billingAccountUpdate').mockResolvedValue({
      data: { data: backupAccount },
    } as never);
    spies.push(updateSpy);
    const deleteSpy = spyOn(sdk, 'billingAccountDelete').mockResolvedValue({
      data: undefined,
    } as never);
    spies.push(deleteSpy);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <BillingAccountsSection
          scope={{ ownerModel: 'Organization', id: org.id }}
          returnUrl="https://app.example.com/billing"
          canManage
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Primary Corp Card')).toBeTruthy();
    });

    expect(screen.getByText('Backup Card')).toBeTruthy();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('Shared')).toBeTruthy();
    expect(screen.getByText(/visa •••• 4242/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Set Default' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { id: backupAccount.id },
          body: { isDefault: true },
        }),
      );
    });

    const sharingSelect = screen.getByLabelText('Sharing for Backup Card') as HTMLSelectElement;
    fireEvent.change(sharingSelect, { target: { value: 'on' } });
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { id: backupAccount.id },
          body: { sharing: 'on' },
        }),
      );
    });

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    const targetDelete = deleteButtons[1];
    if (!targetDelete) throw new Error('expected Delete button for backup account');
    fireEvent.click(targetDelete);
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({ path: { id: backupAccount.id } }),
      );
    });
  });

  it('resolves project billing, supports removing direct overrides, and submits explicit account assignment', async () => {
    const { entity: org } = await buildOrganization();
    const { entity: project } = await buildProject({
      ownerModel: 'Organization',
      organizationId: org.id,
    });
    const account = await serializeAccount({
      ownerModel: BillingAccountOwnerModel.Organization,
      organizationId: org.id,
      name: 'R&D Card',
      status: BillingAccountStatus.active,
      isDefault: false,
      sharing: BillingAccountSharing.on,
      isShared: true,
    });

    spies.push(
      spyOn(sdk, 'billingResourceResolve').mockResolvedValue({
        data: {
          data: {
            resolved: true,
            status: 'active',
            source: 'binding',
            boundAt: 'Project',
            billingResourceId: '01950000-0000-7000-8000-000000000099',
            billingAccount: null,
          },
        },
      } as never),
    );
    const createSpy = spyOn(sdk, 'billingResourceCreate').mockResolvedValue({
      data: { data: {} },
    } as never);
    spies.push(createSpy);
    const deleteSpy = spyOn(sdk, 'billingResourceDelete').mockResolvedValue({
      data: undefined,
    } as never);
    spies.push(deleteSpy);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <BillingResourceSelector
          target={{ resourceModel: 'Project', id: project.id, resourceProjectId: project.id }}
          availableAccounts={[{ id: account.id, name: account.name, status: account.status }]}
          canManage
        />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Billed via explicit override (Project)')).toBeTruthy();
    });
    expect(screen.getByText('Private billing account')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Override' }));
    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          path: { id: '01950000-0000-7000-8000-000000000099' },
        }),
      );
    });

    fireEvent.change(screen.getByLabelText('Select billing account'), {
      target: { value: account.id },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Assign Account' }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            billingAccountId: account.id,
            resourceModel: 'Project',
            resourceProjectId: project.id,
            replaceExisting: true,
          }),
        }),
      );
    });
  });
});
