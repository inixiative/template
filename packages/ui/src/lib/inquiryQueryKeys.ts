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
