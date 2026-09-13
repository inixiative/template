/**
 * @atlas
 * @kind factory
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import {
  meReadManySegmentMemberships,
  meReadManySegmentMembershipsQueryKey,
  meReadManySegments,
  meReadManySegmentsQueryKey,
  organizationReadManySegmentMemberships,
  organizationReadManySegmentMembershipsQueryKey,
  organizationReadManySegments,
  organizationReadManySegmentsQueryKey,
  spaceReadManySegmentMemberships,
  spaceReadManySegmentMembershipsQueryKey,
  spaceReadManySegments,
  spaceReadManySegmentsQueryKey,
} from '@template/sdk';
import { apiQuery } from '@template/ui/lib/apiQuery';
import { makeContextQueries, query } from '@template/ui/lib/makeContextQueries';

export const segmentContextQueries = makeContextQueries()({
  user: () => ({
    owned: query({
      queryKey: meReadManySegmentsQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meReadManySegments>[0]) => meReadManySegments(opts)),
    }),
    memberships: query({
      queryKey: meReadManySegmentMembershipsQueryKey(),
      queryFn: apiQuery((opts: Parameters<typeof meReadManySegmentMemberships>[0]) =>
        meReadManySegmentMemberships(opts),
      ),
    }),
  }),
  organization: ({ organization }) => ({
    owned: query({
      queryKey: organizationReadManySegmentsQueryKey({ path: { id: organization.id } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManySegments>[0]) =>
        organizationReadManySegments({ ...opts, path: { id: organization.id } }),
      ),
    }),
    memberships: query({
      queryKey: organizationReadManySegmentMembershipsQueryKey({ path: { id: organization.id } }),
      queryFn: apiQuery((opts: Parameters<typeof organizationReadManySegmentMemberships>[0]) =>
        organizationReadManySegmentMemberships({ ...opts, path: { id: organization.id } }),
      ),
    }),
  }),
  space: ({ space }) => ({
    owned: query({
      queryKey: spaceReadManySegmentsQueryKey({ path: { id: space.id } }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReadManySegments>[0]) =>
        spaceReadManySegments({ ...opts, path: { id: space.id } }),
      ),
    }),
    memberships: query({
      queryKey: spaceReadManySegmentMembershipsQueryKey({ path: { id: space.id } }),
      queryFn: apiQuery((opts: Parameters<typeof spaceReadManySegmentMemberships>[0]) =>
        spaceReadManySegmentMemberships({ ...opts, path: { id: space.id } }),
      ),
    }),
  }),
});
