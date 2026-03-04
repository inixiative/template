import type { Db, Prisma } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { z } from 'zod';

export type Inquiry = Prisma.InquiryGetPayload<{}>;

// Use real DB field names. String values are content keys to read the FK from.
export type InquirySourceMeta =
  | { sourceModel: (typeof InquiryResourceModel)['admin'] }
  | { sourceModel: (typeof InquiryResourceModel)['User'] }
  | { sourceModel: (typeof InquiryResourceModel)['Organization']; sourceOrganizationId: string }
  | { sourceModel: (typeof InquiryResourceModel)['Space']; sourceSpaceId: string };

export type InquiryTargetMeta =
  | { targetModel: (typeof InquiryResourceModel)['admin'] }
  | { targetModel: (typeof InquiryResourceModel)['User'] }
  | { targetModel: (typeof InquiryResourceModel)['Organization']; targetOrganizationId: string }
  | { targetModel: (typeof InquiryResourceModel)['Space']; targetSpaceId: string };

export type InquiryHandler = {
  sources: InquirySourceMeta[];
  targets: InquiryTargetMeta[];
  contentSchema: z.ZodTypeAny;
  resolutionSchema: z.ZodTypeAny;
  handleApprove: (db: Db, inquiry: Inquiry, resolvedContent: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
  validate?: (db: Db, inquiry: Inquiry) => Promise<void>;
  unique?: boolean;
};
