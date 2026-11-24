/**
 * @atlas
 * @kind type
 * @partOf infrastructure:billing
 * @uses none
 */
import type { BillingAccountStatus, BillingProvider } from '@template/db/generated/client/enums';

export type BillingCustomerKind = 'individual' | 'organization';

export type PaymentMethodSummary = {
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

export type NormalizedAccountState = {
  externalCustomerId: string;
  externalSubscriptionId: string | null;
  status: BillingAccountStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod?: PaymentMethodSummary | null;
  duplicateSubscriptionIds?: readonly string[];
};

export type BillingProviderCapabilities = {
  readonly requiresUniqueEmail: boolean;
  readonly supportsPreAuthPortal: boolean;
  readonly supportsMeteredUsage: boolean;
};

export type EnsureCustomerInput = {
  accountId: string;
  billingEmail: string;
  name: string;
  kind: BillingCustomerKind;
  metadata?: Record<string, string>;
};

export type EnsureCustomerResult = {
  externalCustomerId: string;
};

export type UpdateCustomerInput = {
  accountId: string;
  externalCustomerId: string;
  billingEmail?: string;
  name?: string;
};

export type CreateSetupSessionInput = {
  accountId: string;
  externalCustomerId: string;
  billingEmail: string;
  mode: 'payAsYouGo' | 'subscription';
  planKey?: string;
  successUrl: string;
  returnUrl: string;
  metadata?: Record<string, string>;
};

export type CreateSetupSessionResult = {
  url: string;
  externalSessionId: string;
  expiresAt: Date | null;
};

export type CreatePortalSessionInput = {
  accountId: string;
  externalCustomerId: string;
  returnUrl: string;
};

export type CreatePortalSessionResult = {
  url: string;
};

export type CancelAccountInput = {
  accountId: string;
  externalCustomerId: string;
  externalSubscriptionId: string | null;
  immediate?: boolean;
  releaseCustomer?: boolean;
};

export type CancelAccountResult = {
  status: BillingAccountStatus;
};

export type FetchAccountStateInput = {
  accountId: string;
  externalCustomerId: string;
};

export type BillingUsageEventInput = {
  idempotencyKey: string;
  accountId: string;
  externalCustomerId: string;
  meterName: string;
  value: string | number;
  occurredAt: Date;
  metadata?: Record<string, string | number | boolean>;
};

export type RejectedUsageEvent = {
  idempotencyKey: string;
  reason: string;
  retryable: boolean;
};

export type IngestUsageEventsResult = {
  accepted: number;
  rejected: RejectedUsageEvent[];
};

export type ParseWebhookInput = {
  rawBody: string;
  headers: Headers | Record<string, string | undefined>;
};

export type NormalizedBillingWebhookEvent =
  | {
      externalEventId: string;
      rawEventType: string;
      occurredAt: Date;
      rawPayload: Record<string, unknown>;
      kind: 'accountStateChanged';
      accountId: string | null;
      externalCustomerId: string;
      state: NormalizedAccountState;
    }
  | {
      externalEventId: string;
      rawEventType: string;
      occurredAt: Date;
      rawPayload: Record<string, unknown>;
      kind: 'paymentSucceeded';
      accountId: string | null;
      externalCustomerId: string;
      externalInvoiceId: string;
      amountMinorUnits: number;
      currency: string;
      paidAt: Date;
    }
  | {
      externalEventId: string;
      rawEventType: string;
      occurredAt: Date;
      rawPayload: Record<string, unknown>;
      kind: 'paymentFailed';
      accountId: string | null;
      externalCustomerId: string;
      externalInvoiceId: string;
      reason: string | null;
    }
  | {
      externalEventId: string;
      rawEventType: string;
      occurredAt: Date;
      rawPayload: Record<string, unknown>;
      kind: 'ignored';
    };

export type BillingClient = {
  readonly provider: BillingProvider;
  readonly capabilities: BillingProviderCapabilities;
  ensureCustomer: (input: EnsureCustomerInput) => Promise<EnsureCustomerResult>;
  updateCustomer: (input: UpdateCustomerInput) => Promise<void>;
  createSetupSession: (input: CreateSetupSessionInput) => Promise<CreateSetupSessionResult>;
  createPortalSession: (input: CreatePortalSessionInput) => Promise<CreatePortalSessionResult>;
  cancelAccount: (input: CancelAccountInput) => Promise<CancelAccountResult>;
  fetchAccountState: (input: FetchAccountStateInput) => Promise<NormalizedAccountState>;
  ingestUsageEvents: (
    events: readonly BillingUsageEventInput[],
  ) => Promise<IngestUsageEventsResult>;
  parseWebhook: (input: ParseWebhookInput) => Promise<NormalizedBillingWebhookEvent>;
};
