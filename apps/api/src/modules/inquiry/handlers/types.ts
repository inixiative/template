import type { Db, Prisma } from '@template/db';
import type { z } from 'zod';

export type Inquiry = Prisma.InquiryGetPayload<{}>;

export type InquiryHandler = {
  contentSchema: z.ZodTypeAny;
  resolutionSchema: z.ZodTypeAny;
  handleApprove: (db: Db, inquiry: Inquiry, resolvedContent: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
  validate?: (db: Db, inquiry: Inquiry) => Promise<void>;
  unique?: boolean;
};
