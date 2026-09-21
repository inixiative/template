/**
 * @atlas
 * @kind config
 * @partOf infrastructure:observability
 * @uses none
 */
import { z } from 'zod';

export const browserTelemetrySchema = z
  .object({
    app: z.enum(['web', 'admin', 'superadmin']),
    spans: z
      .array(
        z
          .object({
            traceId: z
              .string()
              .regex(/^[a-f0-9]{32}$/)
              .refine((value) => /[1-9a-f]/.test(value)),
            spanId: z
              .string()
              .regex(/^[a-f0-9]{16}$/)
              .refine((value) => /[1-9a-f]/.test(value)),
            name: z.enum(['api.request', 'browser.error', 'page.load']),
            startTimeMs: z.number().finite().nonnegative(),
            durationMs: z.number().finite().min(0).max(600_000),
            error: z.boolean(),
            method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']).optional(),
            status: z.number().int().min(0).max(599).optional(),
            route: z
              .string()
              .max(200)
              .regex(/^\/[A-Za-z0-9_/:{}.-]*$/)
              .optional(),
            errorType: z.string().max(100).optional(),
            errorMessage: z.string().max(1000).optional(),
            errorStack: z.string().max(4000).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type BrowserTelemetry = z.infer<typeof browserTelemetrySchema>;
