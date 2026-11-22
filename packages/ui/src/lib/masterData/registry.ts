/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import {
  contactInfo,
  contactInfoQueryKey,
  inquiryInfo,
  inquiryInfoQueryKey,
  segmentInfo,
  segmentInfoQueryKey,
  webhookSubscriptionInfo,
  webhookSubscriptionInfoQueryKey,
} from '@template/sdk';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';

export const MASTER_DATA_STALE_TIME = Number.POSITIVE_INFINITY;
export const MASTER_DATA_GC_TIME = Number.POSITIVE_INFINITY;

export type MasterDataEntry = {
  readonly key: string;
  readonly path: string;
  readonly queryKey: readonly unknown[];
  readonly fetch: SdkFunction;
};

/**
 * Static-per-deploy `/api/v1/<model>/info` catalogs preloaded together on authenticated mount
 * via `POST /api/v1/batch/execute` (`strategy: 'allowFailures'`). Each entry keeps its own SDK
 * query key and fallback fetch function (R-2026-11-18-10).
 */
export const MASTER_DATA_ENTRIES = [
  {
    key: 'contact',
    path: '/api/v1/contact/info',
    queryKey: contactInfoQueryKey(),
    fetch: contactInfo as SdkFunction,
  },
  {
    key: 'inquiry',
    path: '/api/v1/inquiry/info',
    queryKey: inquiryInfoQueryKey(),
    fetch: inquiryInfo as SdkFunction,
  },
  {
    key: 'segment',
    path: '/api/v1/segment/info',
    queryKey: segmentInfoQueryKey(),
    fetch: segmentInfo as SdkFunction,
  },
  {
    key: 'webhookSubscription',
    path: '/api/v1/webhookSubscription/info',
    queryKey: webhookSubscriptionInfoQueryKey(),
    fetch: webhookSubscriptionInfo as SdkFunction,
  },
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific /api/v1/<model>/info catalogs below
  // ==========================================================================
] as const satisfies readonly MasterDataEntry[];

export type MasterDataKey = (typeof MASTER_DATA_ENTRIES)[number]['key'];
