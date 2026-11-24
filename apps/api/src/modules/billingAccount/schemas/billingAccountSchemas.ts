/**
 * @atlas
 * @kind schema
 * @partOf feature:billing
 * @uses infrastructure:prisma
 */
import { z } from '@hono/zod-openapi';
import { BillingAccountScalarSchema } from '@template/db';
import type { BillingAccount } from '@template/db/generated/client/client';
import { BillingAccountSharing, BillingProvider } from '@template/db/generated/client/enums';
import { omit } from 'lodash-es';

export const BILLING_ACCOUNT_IMMUTABLE_FIELDS = [
  'id',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'ownerModel',
  'userId',
  'organizationId',
  'spaceId',
  'isShared',
  'status',
  'provider',
  'externalCustomerId',
  'externalSubscriptionId',
  'currentPeriodStart',
  'currentPeriodEnd',
  'cancelAtPeriodEnd',
  'paymentMethodType',
  'paymentMethodBrand',
  'paymentMethodLast4',
  'paymentMethodExpMonth',
  'paymentMethodExpYear',
  'lastSyncedAt',
] as const;

export const billingAccountReadResponseSchema = BillingAccountScalarSchema.omit({
  externalCustomerId: true,
  externalSubscriptionId: true,
});

export const toBillingAccountResponse = (account: BillingAccount) =>
  omit(account, ['externalCustomerId', 'externalSubscriptionId']);

export const billingAccountCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  billingEmail: z.email().max(320),
  isDefault: z.boolean().optional(),
  sharing: z.enum(BillingAccountSharing).optional(),
  provider: z.enum(BillingProvider).optional(),
});

export const billingAccountUpdateBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  billingEmail: z.email().max(320).optional(),
  isDefault: z.boolean().optional(),
  sharing: z.enum(BillingAccountSharing).optional(),
});

const httpUrlSchema = z.url({ protocol: /^https?$/ });

export const billingAccountSetupSessionBodySchema = z.object({
  successUrl: httpUrlSchema,
  returnUrl: httpUrlSchema,
  mode: z.enum(['payAsYouGo', 'subscription']).default('payAsYouGo'),
  planKey: z.string().min(1).max(120).optional(),
});

export const billingAccountSetupSessionResponseSchema = z.object({
  url: z.url(),
  externalSessionId: z.string(),
  expiresAt: z.date().nullable(),
});

export const billingAccountPortalSessionBodySchema = z.object({
  returnUrl: httpUrlSchema,
});

export const billingAccountPortalSessionResponseSchema = z.object({
  url: z.url(),
});

export const billingAccountInfoResponseSchema = z.object({
  defaultProvider: z.enum(BillingProvider),
  capabilities: z.object({
    requiresUniqueEmail: z.boolean(),
    supportsPreAuthPortal: z.boolean(),
    supportsMeteredUsage: z.boolean(),
  }),
});
