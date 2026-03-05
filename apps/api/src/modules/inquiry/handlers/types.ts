import type { Db, Prisma } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import type { BaseResolution } from '#/modules/inquiry/handlers/schemas';

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

export type InquiryHandler<
  TContent extends Record<string, unknown> = Record<string, unknown>,
  TResolution extends Record<string, unknown> = BaseResolution,
  TResolutionInput extends Record<string, unknown> = BaseResolution,
> = {
  sources: InquirySourceMeta[];
  targets: InquiryTargetMeta[];
  contentSchema: z.ZodType<TContent>;
  resolutionInputSchema: z.ZodType<TResolutionInput>;
  resolutionSchema: z.ZodType<TResolution>;
  handleApprove(db: Db, inquiry: Inquiry, resolvedContent: TContent): Promise<Partial<TResolution> | void>;
  validate?(db: Db, inquiry: Inquiry, content: TContent): Promise<void>;
  unique?: boolean;
};
