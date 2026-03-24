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
import { makeContextQueries } from '@template/ui/lib/makeContextQueries';

type InquiryQueryParams = { query?: Record<string, unknown> };

export const inquiryContextQueries = makeContextQueries<InquiryQueryParams>()({
  user: (_args, params) => ({
    sent: {
      queryKey: meSentManyInquiriesQueryKey({ query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof meSentManyInquiries>[0]) => meSentManyInquiries(opts)),
    },
    received: {
      queryKey: meReceivedManyInquiriesQueryKey({ query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof meReceivedManyInquiries>[0]) => meReceivedManyInquiries(opts)),
    },
  }),
  organization: ({ organization }, params) => ({
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
  space: ({ space }, params) => ({
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
