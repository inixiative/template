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

export const SpaceUpdateInquiryPage = () => {
  const context = useAppStore((state) => state.tenant.context) as AuthenticatedContext;
  const permissions = useAppStore((state) => state.permissions);
  const spaceId = context.space!.id;
  const organizationId = context.organization?.id ?? '';

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: spaceSentManyInquiriesQueryKey({ path: { id: spaceId } }),
    queryFn: apiQuery((opts: Parameters<typeof spaceSentManyInquiries>[0]) =>
      spaceSentManyInquiries({ ...opts, path: { id: spaceId } }),
    ),
  });

  const allInquiries = (data?.data ?? []).filter((inq) => inq.type === 'updateSpace');
  const activeInquiry = allInquiries.find((inq) => !isTerminal(inq));

  const createMutation = useCreateInquiryMutation();

  const canRequestUpdate = checkPermission(
    permissions,
    'inquiry',
    {
      id: '',
      type: 'updateSpace',
      sourceSpaceId: spaceId,
      sourceOrganizationId: organizationId,
      targetOrganizationId: '',
      sourceSpace: { id: spaceId } as HydratedRecord,
    } as unknown as HydratedRecord,
    'send',
  );

  const handleSubmit = () => {
    const content: { name?: string; slug?: string } = {};
    if (name.trim()) content.name = name.trim();
    if (slug.trim()) content.slug = slug.trim();

    createMutation.mutate({
      inquiry: {
        type: 'updateSpace',
        sourceOrganizationId: organizationId,
        sourceSpaceId: spaceId,
        targetOrganizationId: '',
      },
      call: () =>
        spaceCreateInquiry({
          path: { id: spaceId },
          body: {
            type: 'updateSpace',
            status: 'sent',
            content,
            targetModel: 'admin',
          },
        }),
      optimisticItem: {
        type: 'updateSpace',
        status: 'sent',
        content,
      },
    });
    setName('');
    setSlug('');
  };

  if (isLoading) {
    return <div className="p-8">Loading...</div>;
  }

  const activeContent = activeInquiry?.content as { name?: string; slug?: string } | null | undefined;

  return (
    <div className="p-8 space-y-6">
      {activeInquiry ? (
        <Card>
          <CardHeader>
            <CardTitle>Update Request In Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={STATUS_COLORS[activeInquiry.status]}>
                <span className="capitalize">{activeInquiry.status}</span>
              </Badge>
            </div>
            {activeContent?.name && (
              <div>
                <p className="text-sm text-muted-foreground">Proposed Name</p>
                <p className="text-sm font-medium">{activeContent.name}</p>
              </div>
            )}
            {activeContent?.slug && (
              <div>
                <p className="text-sm text-muted-foreground">Proposed Slug</p>
                <p className="text-sm font-medium">{activeContent.slug}</p>
              </div>
            )}
            <InquirySourceControls inquiry={activeInquiry} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Request Space Update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="update-name">
                New Name
              </label>
              <input
                id="update-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Leave blank to keep current"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="update-slug">
                New Slug
              </label>
              <input
                id="update-slug"
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Leave blank to keep current"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <Button
              show={canRequestUpdate}
              onClick={handleSubmit}
              disabled={createMutation.isPending || (!name.trim() && !slug.trim())}
            >
              Submit Request
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
