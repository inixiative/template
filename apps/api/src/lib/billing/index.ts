/**
 * @atlas
 * @kind adapter
 * @partOf infrastructure:billing
 * @uses primitive:shared
 */
import { BillingProvider } from '@template/db/generated/client/enums';
import { makeAdapterRegistry, resolveAdapterForEnvironmentOrThrow } from '@template/shared/adapter';
import { isProd } from '@template/shared/utils';
import { createPolarBillingClient } from '#/lib/billing/client/polar';
import type { BillingClient } from '#/lib/billing/types';

const isSandbox = !isProd;

const polarClient = createPolarBillingClient({
  apiKey: isSandbox
    ? (process.env.POLAR_SANDBOX_API_KEY ?? process.env.POLAR_API_KEY)
    : process.env.POLAR_API_KEY,
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET,
  sandbox: isSandbox,
  payAsYouGoProductId: process.env.POLAR_PAYG_PRODUCT_ID,
});

export const billingRegistry = makeAdapterRegistry<BillingClient>();
billingRegistry.register(BillingProvider.polar, polarClient);

export const defaultBillingClient = resolveAdapterForEnvironmentOrThrow<BillingClient>({
  prod: polarClient,
  staging: polarClient,
  pr: polarClient,
  default: polarClient,
});

export const billingClientForProviderOrThrow = (provider: BillingProvider): BillingClient =>
  billingRegistry.get(provider);

export type {
  BillingClient,
  BillingCustomerKind,
  BillingProviderCapabilities,
  BillingUsageEventInput,
  CancelAccountInput,
  CancelAccountResult,
  CreatePortalSessionInput,
  CreatePortalSessionResult,
  CreateSetupSessionInput,
  CreateSetupSessionResult,
  EnsureCustomerInput,
  EnsureCustomerResult,
  FetchAccountStateInput,
  IngestUsageEventsResult,
  NormalizedAccountState,
  NormalizedBillingWebhookEvent,
  ParseWebhookInput,
  PaymentMethodSummary,
  RejectedUsageEvent,
  UpdateCustomerInput,
} from '#/lib/billing/types';
