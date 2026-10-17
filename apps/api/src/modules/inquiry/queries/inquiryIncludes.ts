/**
 * @atlas
 * @kind query
 * @partOf feature:inquiry
 * @uses none
 */
import type { Prisma } from '@template/db';

export const includeInquiryResponse = {
  sourceUser: true,
  sourceOrganization: true,
  sourceSpace: true,
  targetUser: true,
  targetOrganization: true,
  targetSpace: true,
} as const satisfies Prisma.InquiryInclude;

export const includeInquirySent = {
  targetUser: true,
  targetOrganization: true,
  targetSpace: true,
} as const satisfies Prisma.InquiryInclude;

export const includeInquiryReceived = {
  sourceUser: true,
  sourceOrganization: true,
  sourceSpace: true,
} as const satisfies Prisma.InquiryInclude;
