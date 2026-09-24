/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { HydratedRecord } from '@template/db';
import { spaceCreateInquiry, spaceSentManyInquiries, spaceSentManyInquiriesQueryKey } from '@template/sdk';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Page } from '@template/ui/components';
import { InquirySourceControls } from '@template/ui/components/inquiries';
import { useCreateInquiryMutation, useQuery } from '@template/ui/hooks';
import { checkPermission } from '@template/ui/hooks/usePermission';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { INQUIRY_STATUS_COLORS, isTerminalInquiry } from '@template/ui/lib/inquiries/queryKeys';
import { useAppStore } from '@template/ui/store';
import type { AuthenticatedContext } from '@template/ui/store/types/tenant';
import { useState } from 'react';

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
  const activeInquiry = allInquiries.find((inq) => !isTerminalInquiry(inq));

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

  const activeContent = activeInquiry?.content as { name?: string; slug?: string } | null | undefined;

  return (
    <Page
      title="Update space"
      description="Request a new name or slug for this space. Changes take effect once a platform admin approves them."
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
      ) : activeInquiry ? (
        <Card>
          <CardHeader>
            <CardTitle>Update request in progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge className={INQUIRY_STATUS_COLORS[activeInquiry.status]}>
                <span className="capitalize">{activeInquiry.status}</span>
              </Badge>
            </div>
            {activeContent?.name && (
              <div>
                <p className="text-sm text-muted-foreground">Proposed name</p>
                <p className="text-sm font-medium">{activeContent.name}</p>
              </div>
            )}
            {activeContent?.slug && (
              <div>
                <p className="text-sm text-muted-foreground">Proposed slug</p>
                <p className="text-sm font-medium">{activeContent.slug}</p>
              </div>
            )}
            <InquirySourceControls inquiry={activeInquiry} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>New update request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="update-name">
                New name
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
                New slug
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
              Submit request
            </Button>
          </CardContent>
        </Card>
      )}
    </Page>
  );
};
