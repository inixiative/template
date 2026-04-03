import { z } from 'zod';
import { makeAppEvent } from '#/events/makeAppEvent';

export const inquirySentEvent = makeAppEvent({
  type: 'inquiry.sent',
  schema: z.object({
    inquiryId: z.string(),
    inquiryType: z.string(),
    sourceOrganizationId: z.string().optional(),
    sourceUserId: z.string().optional(),
    targetUserId: z.string().optional(),
    targetModel: z.string(),
  }),
  email: async (event) => {
    if (event.data.inquiryType !== 'inviteOrganizationUser') return null;
    if (!event.data.targetUserId) return null;

    return [
      {
        target: { userIds: [event.data.targetUserId] },
        message: {
          template: 'org-invitation',
          data: {
            inquiryId: event.data.inquiryId,
            sourceOrganizationId: event.data.sourceOrganizationId,
            sourceUserId: event.data.sourceUserId,
          },
        },
        tags: ['inquiry', 'invitation'],
        category: 'system' as const,
        context: { organizationId: event.data.sourceOrganizationId },
      },
    ];
  },
  websocket: async (event) => {
    if (!event.data.targetUserId) return null;

    return [
      {
        target: { userIds: [event.data.targetUserId] },
        message: {
          data: {
            event: 'inquiry.sent',
            inquiryId: event.data.inquiryId,
            type: event.data.inquiryType,
          },
        },
      },
    ];
  },
});
