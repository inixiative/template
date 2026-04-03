import { z } from 'zod';
import { makeAppEvent } from '#/events/makeAppEvent';

export const inquiryResolvedEvent = makeAppEvent({
  type: 'inquiry.resolved',
  schema: z.object({
    inquiryId: z.string(),
    inquiryType: z.string(),
    resolution: z.enum(['approved', 'denied', 'changesRequested']),
    sourceOrganizationId: z.string().optional(),
    sourceUserId: z.string().optional(),
    targetUserId: z.string().optional(),
  }),
  websocket: async (event) => {
    const targets: string[] = [];
    if (event.data.sourceUserId) targets.push(event.data.sourceUserId);
    if (event.data.targetUserId) targets.push(event.data.targetUserId);
    if (!targets.length) return null;

    return [
      {
        target: { userIds: targets },
        message: {
          data: {
            event: 'inquiry.resolved',
            inquiryId: event.data.inquiryId,
            type: event.data.inquiryType,
            resolution: event.data.resolution,
          },
        },
      },
    ];
  },
});
