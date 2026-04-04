import type { Db, Prisma, PrismaBaseArgs } from '@template/db';
import type { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import type { AppEventHandlerDefinition } from '#/appEvents/types';
import type { BaseResolution } from '#/modules/inquiry/handlers/schemas';

export type Inquiry = Prisma.InquiryGetPayload<PrismaBaseArgs>;

export type InquiryAppEvents = {
  sent?: AppEventHandlerDefinition<Inquiry>;
  approved?: AppEventHandlerDefinition<Inquiry>;
  denied?: AppEventHandlerDefinition<Inquiry>;
  resolved?: AppEventHandlerDefinition<Inquiry>;
};

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
  appEvents?: InquiryAppEvents;
};
