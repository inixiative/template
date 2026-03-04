import type { Db, Prisma } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { z } from 'zod';

export type Inquiry = Prisma.InquiryGetPayload<{}>;

// Use real DB field names. String values are content keys to read the FK from.
export type InquirySourceMeta =
  | { sourceModel: InquiryResourceModel.admin }
  | { sourceModel: InquiryResourceModel.User }
  | { sourceModel: InquiryResourceModel.Organization; sourceOrganizationId: string }
  | { sourceModel: InquiryResourceModel.Space; sourceSpaceId: string };

export type InquiryTargetMeta =
  | { targetModel: InquiryResourceModel.admin }
  | { targetModel: InquiryResourceModel.User }
  | { targetModel: InquiryResourceModel.Organization; targetOrganizationId: string }
  | { targetModel: InquiryResourceModel.Space; targetSpaceId: string };

export type InquiryHandler = {
  sources: InquirySourceMeta[];
  targets: InquiryTargetMeta[];
  contentSchema: z.ZodTypeAny;
  resolutionSchema: z.ZodTypeAny;
  handleApprove: (db: Db, inquiry: Inquiry, resolvedContent: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
  validate?: (db: Db, inquiry: Inquiry) => Promise<void>;
  unique?: boolean;
};
