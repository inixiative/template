import type { Db, Prisma, PrismaBaseArgs } from '@template/db';
import type { InquiryResourceModel } from '@template/db/generated/client/enums';
import type { z } from 'zod';
import type { AppEventHandlerDefinition } from '#/appEvents/types';
import type { BaseResolution } from '#/modules/inquiry/handlers/schemas';
import type { includeInquiryResponse } from '#/modules/inquiry/queries/inquiryIncludes';

export type Inquiry = Prisma.InquiryGetPayload<PrismaBaseArgs>;

// InquiryWithIncludes is the contract app-event handlers see. Different routes
// load different subsets — sent routes hydrate target* relations only, received
// routes hydrate source* only — so the shape must accept either. We mark each
// relation Partial<> so a value loaded with includeInquirySent OR
// includeInquiryReceived OR includeInquiryResponse is assignable. Handlers
// that read a relation must check for undefined.
type InquiryAllRelations = Prisma.InquiryGetPayload<{ include: typeof includeInquiryResponse }>;
type InquiryRelationsOnly = Omit<InquiryAllRelations, keyof Inquiry>;
export type InquiryWithIncludes = Inquiry & Partial<InquiryRelationsOnly>;

export type InquiryAppEvents = {
  sent?: AppEventHandlerDefinition<InquiryWithIncludes>;
  approved?: AppEventHandlerDefinition<InquiryWithIncludes>;
  denied?: AppEventHandlerDefinition<InquiryWithIncludes>;
  changesRequested?: AppEventHandlerDefinition<InquiryWithIncludes>;
  resolved?: AppEventHandlerDefinition<InquiryWithIncludes>;
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
