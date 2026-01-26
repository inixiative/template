import * as z from 'zod';

export const InquiryScalarFieldEnumSchema = z.enum(['id', 'createdAt', 'updatedAt', 'sentAt', 'type', 'status', 'content', 'resolution', 'sourceModel', 'sourceUserId', 'sourceOrganizationId', 'targetModel', 'targetUserId', 'targetOrganizationId'])

export type InquiryScalarFieldEnum = z.infer<typeof InquiryScalarFieldEnumSchema>;