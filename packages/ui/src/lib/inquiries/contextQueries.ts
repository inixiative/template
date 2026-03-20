import {
  meReceivedManyInquiries,
  meReceivedManyInquiriesQueryKey,
  meSentManyInquiries,
  meSentManyInquiriesQueryKey,
  organizationReceivedManyInquiries,
  organizationReceivedManyInquiriesQueryKey,
  organizationSentManyInquiries,
  organizationSentManyInquiriesQueryKey,
  spaceReceivedManyInquiries,
  spaceReceivedManyInquiriesQueryKey,
  spaceSentManyInquiries,
  spaceSentManyInquiriesQueryKey,
} from '@template/ui/apiClient';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { makeContextQueries, type QuerySlot } from '@template/ui/lib/makeContextQueries';

type InquiryQueries = { sent: QuerySlot; received: QuerySlot };
type InquiryQueryParams = { query?: Record<string, unknown> };

export const inquiryContextQueries = makeContextQueries<InquiryQueries, InquiryQueryParams>({
  user: (_args, params): InquiryQueries => ({
    sent: {
      queryKey: meSentManyInquiriesQueryKey({ query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof meSentManyInquiries>[0]) => meSentManyInquiries(opts)),
    },
    received: {
      queryKey: meReceivedManyInquiriesQueryKey({ query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof meReceivedManyInquiries>[0]) => meReceivedManyInquiries(opts)),
    },
  }),
  organization: ({ organization }, params): InquiryQueries => ({
    sent: {
      queryKey: organizationSentManyInquiriesQueryKey({ path: { id: organization.id }, query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof organizationSentManyInquiries>[0]) =>
        organizationSentManyInquiries({ ...opts, path: { id: organization.id } }),
      ),
    },
    received: {
      queryKey: organizationReceivedManyInquiriesQueryKey({ path: { id: organization.id }, query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReceivedManyInquiries>[0]) =>
        organizationReceivedManyInquiries({ ...opts, path: { id: organization.id } }),
      ),
    },
  }),
  space: ({ space }, params): InquiryQueries => ({
    sent: {
      queryKey: spaceSentManyInquiriesQueryKey({ path: { id: space.id }, query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof spaceSentManyInquiries>[0]) =>
        spaceSentManyInquiries({ ...opts, path: { id: space.id } }),
      ),
    },
    received: {
      queryKey: spaceReceivedManyInquiriesQueryKey({ path: { id: space.id }, query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReceivedManyInquiries>[0]) =>
        spaceReceivedManyInquiries({ ...opts, path: { id: space.id } }),
      ),
    },
  }),
});
