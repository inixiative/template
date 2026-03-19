import {
  type InquirySentItem,
  spaceCreateInquiry,
  spaceSentManyInquiries,
  spaceSentManyInquiriesQueryKey,
} from '@template/ui/apiClient';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@template/ui/components';
import { InquirySourceControls } from '@template/ui/components/inquiries';
import { useCreateInquiryMutation, useQuery } from '@template/ui/hooks';
import type { HydratedRecord } from '@template/db';
import { checkPermission } from '@template/ui/hooks/usePermission';
import { apiQuery } from '@template/ui/lib/apiQuery';
import type { InquiryStatus } from '@template/ui/lib/inquiryQueryKeys';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useState } from 'react';

const STATUS_COLORS: Record<InquiryStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  changesRequested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-700',
};

const TERMINAL_STATUSES: InquiryStatus[] = ['approved', 'denied', 'canceled'];

const isTerminal = (inq: InquirySentItem): boolean => {
  if (TERMINAL_STATUSES.includes(inq.status)) return true;
  if (inq.expiresAt && new Date(inq.expiresAt) < new Date()) return true;
  return false;
};

export const SpaceTransferInquiryPage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const permissions = useAppStore((state) => state.permissions);
  const spaceId = context.space!.id;
  const organizationId = context.organization?.id ?? '';

  const [targetOrgSlug, setTargetOrgSlug] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: spaceSentManyInquiriesQueryKey({ path: { id: spaceId } }),
    queryFn: apiQuery((opts: Parameters<typeof spaceSentManyInquiries>[0]) =>
      spaceSentManyInquiries({ ...opts, path: { id: spaceId } }),
    ),
  });

  const allInquiries = (data?.data ?? []).filter((inq) => inq.type === 'transferSpace');
  const activeInquiry = allInquiries.find((inq) => !isTerminal(inq));

  const createMutation = useCreateInquiryMutation();

  const canRequestTransfer = checkPermission(
    permissions,
    'inquiry',
    {
      id: '',
      type: 'transferSpace',
      sourceSpaceId: spaceId,
      sourceOrganizationId: organizationId,
      targetOrganizationId: '',
      sourceSpace: { id: spaceId, organization: { id: organizationId } as HydratedRecord } as HydratedRecord,
    } as unknown as HydratedRecord,
    'send',
  );

  const handleSubmit = () => {
    createMutation.mutate({
      inquiry: {
        type: 'transferSpace',
        sourceOrganizationId: organizationId,
        sourceSpaceId: spaceId,
        targetOrganizationId: '',
      },
      call: () =>
        spaceCreateInquiry({
          path: { id: spaceId },
          body: {
            type: 'transferSpace',
            status: 'sent',
            content: {},
            targetModel: 'Organization',
            targetOrganizationSlug: targetOrgSlug.trim(),
          },
        }),
      optimisticItem: {
        type: 'transferSpace',
        status: 'sent',
        targetOrganization: null,
      },
    });
    setTargetOrgSlug('');
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {activeInquiry ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer In Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={STATUS_COLORS[activeInquiry.status]}>
                <span className="capitalize">{activeInquiry.status}</span>
              </Badge>
            </div>
            {activeInquiry.targetOrganization && (
              <div>
                <p className="text-sm text-muted-foreground">Target Organization</p>
                <p className="text-sm font-medium">{activeInquiry.targetOrganization.name}</p>
              </div>
            )}
            <InquirySourceControls inquiry={activeInquiry} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Transfer Space</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Request to transfer this space to another organization. The target organization must approve the transfer.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="target-org-slug">
                Target Organization Slug
              </label>
              <input
                id="target-org-slug"
                type="text"
                value={targetOrgSlug}
                onChange={(e) => setTargetOrgSlug(e.target.value)}
                placeholder="organization-slug"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <Button
              show={canRequestTransfer}
              onClick={handleSubmit}
              disabled={createMutation.isPending || !targetOrgSlug.trim()}
            >
              Request Transfer
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
