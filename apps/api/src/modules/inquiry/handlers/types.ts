import type { Db, Prisma } from '@template/db';
import { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import type { BaseResolution } from '#/modules/inquiry/handlers/schemas';

export type Inquiry = Prisma.InquiryGetPayload<{}>;

export type InquiryHandler<
  TContent extends Record<string, unknown> = Record<string, unknown>,
  TResolution extends Record<string, unknown> = BaseResolution,
  TResolutionInput extends Record<string, unknown> = BaseResolution,
> = {
  sources: { sourceModel: InquiryResourceModel }[];
  targets: { targetModel: InquiryResourceModel }[];
  contentSchema: z.ZodType<TContent>;
  resolutionInputSchema: z.ZodType<TResolutionInput>;
  resolutionSchema: z.ZodType<TResolution>;
  handleApprove(db: Db, inquiry: Inquiry, resolvedContent: TContent): Promise<Partial<TResolution> | void>;
  validate?(db: Db, inquiry: Partial<Inquiry>, content: TContent): Promise<void>;
  unique?: 'targeted' | 'untargeted';
};
