import * as z from 'zod';
export const SessionGroupByResultSchema = z.array(z.object({
  id: z.string(),
  userId: z.string(),
  token: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string(),
  userAgent: z.string(),
  createdAt: z.date(),
  _count: z.object({
    id: z.number(),
    userId: z.number(),
    token: z.number(),
    expiresAt: z.number(),
    ipAddress: z.number(),
    userAgent: z.number(),
    createdAt: z.number(),
    user: z.number()
  }).optional(),
  _min: z.object({
    id: z.string().nullable(),
    userId: z.string().nullable(),
    token: z.string().nullable(),
    expiresAt: z.date().nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: z.date().nullable()
  }).nullable().optional(),
  _max: z.object({
    id: z.string().nullable(),
    userId: z.string().nullable(),
    token: z.string().nullable(),
    expiresAt: z.date().nullable(),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: z.date().nullable()
  }).nullable().optional()
}));