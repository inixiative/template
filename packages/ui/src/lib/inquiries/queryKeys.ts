import type { QueryKey } from '@tanstack/react-query';
import type { InquiryItem } from '@template/ui/apiClient';
import {
  meReceivedManyInquiriesQueryKey,
  organizationReceivedManyInquiriesQueryKey,
  organizationSentManyInquiriesQueryKey,
  spaceSentManyInquiriesQueryKey,
} from '@template/ui/apiClient';

export type InquiryType = InquiryItem['type'];
export type InquiryStatus = InquiryItem['status'];

export const INQUIRY_TYPE_LABELS: Record<InquiryType, string> = {
  inviteOrganizationUser: 'Organization Invitation',
  createSpace: 'Space Request',
  updateSpace: 'Space Update',
  transferSpace: 'Space Transfer',
};

export const INQUIRY_STATUS_COLORS: Record<InquiryStatus | 'expired', string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  changesRequested: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  denied: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-700',
  expired: 'bg-gray-100 text-gray-700',
};

export const INQUIRY_TERMINAL_STATUSES: InquiryStatus[] = ['approved', 'denied', 'canceled'];

export const isTerminalInquiry = (inq: { status: InquiryStatus; expiresAt?: string | null }): boolean => {
  if (INQUIRY_TERMINAL_STATUSES.includes(inq.status)) return true;
  if (inq.expiresAt && new Date(inq.expiresAt) < new Date()) return true;
  return false;
};

export type InquiryFilters = {
  types?: InquiryType[];
  statuses?: InquiryStatus[];
  includeExpired?: boolean;
};

const mergeBoundedArray = <T>(external: T[] | undefined, internal: T[] | undefined): T[] | undefined => {
  if (!external) return internal;
  if (!internal || internal.length === 0) return external;

  const narrowed = internal.filter((value) => external.includes(value));
  return narrowed.length > 0 ? narrowed : external;
};

const mergeIncludeExpired = (external: boolean | undefined, internal: boolean | undefined): boolean | undefined => {
  if (external === false || internal === false) return false;
  if (external === true) return true;
  return internal;
};

// External filters define the page bounds.
// Internal UI controls can only narrow within those bounds, never widen past them.
export const mergeInquiryFilters = (
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
// NOTE: expiresAt[gte] uses SQL >= semantics, which excludes NULL rows. Inquiries with
// no expiresAt set (null = never expires) are therefore incorrectly hidden when
// includeExpired:false. Fixing this properly requires a dedicated server-side
// includeExpired param that emits: WHERE expiresAt IS NULL OR expiresAt >= now.
export const inquiryFiltersToSearchFields = (filters: InquiryFilters, now?: Date): Record<string, unknown> => {
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
  type: InquiryType;
  sourceOrganizationId: string;
  sourceSpaceId: string;
  targetOrganizationId: string;
};

// Query keys affected when the SOURCE side mutates (cancel/delete)
export const sourceMutations: Record<InquiryType, (inq: InquiryMeta) => QueryKey[]> = {
  inviteOrganizationUser: (inq) => [organizationSentManyInquiriesQueryKey({ path: { id: inq.sourceOrganizationId } })],
  createSpace: (inq) => [organizationSentManyInquiriesQueryKey({ path: { id: inq.sourceOrganizationId } })],
  updateSpace: (inq) => [spaceSentManyInquiriesQueryKey({ path: { id: inq.sourceSpaceId } })],
  transferSpace: (inq) => [spaceSentManyInquiriesQueryKey({ path: { id: inq.sourceSpaceId } })],
};

// Query keys affected when the TARGET side mutates (resolve/approve/deny)
export const targetMutations: Record<InquiryType, (inq: InquiryMeta) => QueryKey[]> = {
  inviteOrganizationUser: (_inq) => [meReceivedManyInquiriesQueryKey()],
  createSpace: (_inq) => [],
  updateSpace: (_inq) => [],
  transferSpace: (inq) => [organizationReceivedManyInquiriesQueryKey({ path: { id: inq.targetOrganizationId } })],
};
