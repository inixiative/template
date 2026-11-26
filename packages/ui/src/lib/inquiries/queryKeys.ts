/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import type { QueryKey } from '@tanstack/react-query';
import type { InquiryItem, InquiryResolveData } from '@template/sdk';
import {
  meReceivedManyInquiriesQueryKey,
  meSentManyInquiriesQueryKey,
  organizationReceivedManyInquiriesQueryKey,
  organizationSentManyInquiriesQueryKey,
  spaceReceivedManyInquiriesQueryKey,
  spaceSentManyInquiriesQueryKey,
} from '@template/sdk';

export type InquiryType = InquiryItem['type'];
export type InquiryStatus = InquiryItem['status'];
export type InquiryResolutionStatus = InquiryResolveData['body']['status'];

export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  inviteOrganizationUser: 'Organization Invitation',
  createSpace: 'Space Request',
  updateSpace: 'Space Update',
  transferSpace: 'Space Transfer',
  transferArtifact: 'Artifact Transfer',
  changeEntitlements: 'Permission Request',
  mergeUser: 'User Merge',
};

export const INQUIRY_STATUS_BADGE_CLASSES: Record<InquiryStatus | 'expired', string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  changesRequested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
};

export const INQUIRY_TERMINAL_STATUSES: InquiryStatus[] = ['approved', 'denied', 'canceled'];

export const isInquiryClosedOrExpired = (inq: {
  status: InquiryStatus;
  expiresAt?: string | null;
}): boolean => {
  if (INQUIRY_TERMINAL_STATUSES.includes(inq.status)) return true;
  if (inq.expiresAt && new Date(inq.expiresAt) < new Date()) return true;
  return false;
};

export type InquiryFilters = {
  types?: InquiryType[];
  statuses?: InquiryStatus[];
  includeExpired?: boolean;
};

const mergeBoundedArray = <T>(
  external: T[] | undefined,
  internal: T[] | undefined,
): T[] | undefined => {
  if (!external) return internal;
  if (!internal || internal.length === 0) return external;

  const narrowed = internal.filter((value) => external.includes(value));
  return narrowed.length > 0 ? narrowed : external;
};

const mergeIncludeExpired = (
  external: boolean | undefined,
  internal: boolean | undefined,
): boolean | undefined => {
  if (external === false || internal === false) return false;
  if (external === true) return true;
  return internal;
};

// External filters define the page bounds.
// Internal UI controls can only narrow within those bounds, never widen past them.
export const narrowInquiryFiltersWithinPageBounds = (
  external: InquiryFilters | undefined,
  internal: InquiryFilters,
): InquiryFilters => ({
  types: mergeBoundedArray(external?.types, internal.types),
  statuses: mergeBoundedArray(external?.statuses, internal.statuses),
  includeExpired: mergeIncludeExpired(external?.includeExpired, internal.includeExpired),
});

// Converts InquiryFilters to bracket-notation searchFields for the API.
//
// includeExpired:false → expiresAt[gte]=<now> (exclude rows whose expiry is already past).
// `now` must be provided by the caller as a memoized value so the query key stays stable
// across renders. Recompute `now` only when the filter is toggled (e.g. useMemo with
// hideExpired as a dependency) to avoid triggering a new fetch every render.
//
// The server handles the NULL case via orNullFields: when expiresAt[gte] is in
// searchFields and 'expiresAt' is listed in orNullFields, the controller emits
// WHERE (expiresAt >= now OR expiresAt IS NULL) — never-expiring inquiries are preserved.
export const inquiryFiltersToSearchFields = (
  filters: InquiryFilters,
  now?: Date,
): Record<string, unknown> => {
  const searchFields: Record<string, unknown> = {};
  if (filters.types?.length) searchFields.type = { in: filters.types };
  if (filters.statuses?.length) searchFields.status = { in: filters.statuses };
  if (filters.includeExpired === false) {
    searchFields.expiresAt = { gte: (now ?? new Date()).toISOString() };
  }
  return searchFields;
};

export type InquiryMeta = {
  id: string;
  updatedAt: string;
  type: InquiryType;
  sourceOrganizationId: string | null;
  sourceSpaceId: string | null;
  targetOrganizationId: string | null;
  targetSpaceId?: string | null;
};

// Query keys affected when the SOURCE side mutates (cancel/delete)
export const queryKeysToInvalidateWhenSourceMutates: Record<
  InquiryType,
  (inq: InquiryMeta) => QueryKey[]
> = {
  inviteOrganizationUser: (inq) => [
    organizationSentManyInquiriesQueryKey({ path: { id: inq.sourceOrganizationId! } }),
  ],
  createSpace: (inq) => [
    organizationSentManyInquiriesQueryKey({ path: { id: inq.sourceOrganizationId! } }),
  ],
  updateSpace: (inq) => [spaceSentManyInquiriesQueryKey({ path: { id: inq.sourceSpaceId! } })],
  transferSpace: (inq) => [spaceSentManyInquiriesQueryKey({ path: { id: inq.sourceSpaceId! } })],
  transferArtifact: (inq) => [
    inq.sourceSpaceId
      ? spaceSentManyInquiriesQueryKey({ path: { id: inq.sourceSpaceId } })
      : inq.sourceOrganizationId
        ? organizationSentManyInquiriesQueryKey({ path: { id: inq.sourceOrganizationId } })
        : meSentManyInquiriesQueryKey(),
  ],
  changeEntitlements: (_inq) => [meSentManyInquiriesQueryKey()],
  mergeUser: (_inq) => [meSentManyInquiriesQueryKey()],
};

// Query keys affected when the TARGET side mutates (resolve/approve/deny)
export const queryKeysToInvalidateWhenTargetMutates: Record<
  InquiryType,
  (inq: InquiryMeta) => QueryKey[]
> = {
  inviteOrganizationUser: (_inq) => [meReceivedManyInquiriesQueryKey()],
  createSpace: (_inq) => [],
  updateSpace: (_inq) => [],
  transferSpace: (inq) => [
    organizationReceivedManyInquiriesQueryKey({ path: { id: inq.targetOrganizationId! } }),
  ],
  transferArtifact: (inq) => [
    inq.targetSpaceId
      ? spaceReceivedManyInquiriesQueryKey({ path: { id: inq.targetSpaceId } })
      : inq.targetOrganizationId
        ? organizationReceivedManyInquiriesQueryKey({ path: { id: inq.targetOrganizationId } })
        : meReceivedManyInquiriesQueryKey(),
  ],
  changeEntitlements: (inq) =>
    inq.targetOrganizationId
      ? [organizationReceivedManyInquiriesQueryKey({ path: { id: inq.targetOrganizationId } })]
      : [meReceivedManyInquiriesQueryKey()],
  mergeUser: (_inq) => [meReceivedManyInquiriesQueryKey()],
};
