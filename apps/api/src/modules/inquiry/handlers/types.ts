import type { Db, Prisma, PrismaBaseArgs } from '@template/db';
import type { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import type { EmailHandoff, WSHandoff } from '#/appEvents/types';
import type { BaseResolution } from '#/modules/inquiry/handlers/schemas';

export type Inquiry = Prisma.InquiryGetPayload<PrismaBaseArgs>;

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
  handleApprove(db: Db, inquiry: Inquiry, resolvedContent: TContent): Promise<Partial<TResolution> | undefined | void>;
  validate?(db: Db, inquiry: Partial<Inquiry>, content: TContent): Promise<void>;
  autoApprove(db: Db, inquiry: Inquiry): Promise<boolean>;
  unique?: 'targeted' | 'untargeted';
  defaultExpirationDays?: number;

  /** Notification callbacks — return handoffs for bridges when inquiry lifecycle events fire */
  onSent?: (inquiry: Inquiry) => EmailHandoff[] | null;
  onApproved?: (inquiry: Inquiry) => EmailHandoff[] | null;
  onDenied?: (inquiry: Inquiry) => EmailHandoff[] | null;
  onSentWS?: (inquiry: Inquiry) => WSHandoff[] | null;
  onResolvedWS?: (inquiry: Inquiry) => WSHandoff[] | null;
};
