/**
 * @atlas
 * @kind registry
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import {
  contactInfoQueryKey,
  inquiryInfoQueryKey,
  segmentInfoQueryKey,
  webhookSubscriptionInfoQueryKey,
} from '@template/sdk';
import type { BatchQueryDescriptor } from '@template/ui/lib/batch/executeBatchQueries';

export const MASTER_DATA_STALE_TIME = Number.POSITIVE_INFINITY;
export const MASTER_DATA_GC_TIME = Number.POSITIVE_INFINITY;

export type MasterDataEntry = BatchQueryDescriptor;

/**
 * Static-per-deploy `/api/v1/<model>/info` catalogs preloaded together on authenticated mount
 * via `POST /api/v1/batch/execute` (`strategy: 'allowFailures'`). Each entry keeps its own SDK
 * query key and fallback fetch hook (R-2026-11-18-10).
 */
export const MASTER_DATA_ENTRIES = [
  {
    key: 'contact',
    path: '/api/v1/contact/info',
    queryKey: contactInfoQueryKey(),
  },
  {
    key: 'inquiry',
    path: '/api/v1/inquiry/info',
    queryKey: inquiryInfoQueryKey(),
  },
  {
    key: 'segment',
    path: '/api/v1/segment/info',
    queryKey: segmentInfoQueryKey(),
  },
  {
    key: 'webhookSubscription',
    path: '/api/v1/webhookSubscription/info',
    queryKey: webhookSubscriptionInfoQueryKey(),
  },
  // ==========================================================================
  // TEMPLATE ABOVE — Add app-specific /api/v1/<model>/info catalogs below
  // ==========================================================================
] as const satisfies readonly MasterDataEntry[];

export type MasterDataKey = (typeof MASTER_DATA_ENTRIES)[number]['key'];

export const masterDataEntryFor = (key: MasterDataKey): MasterDataEntry => {
  const entry = MASTER_DATA_ENTRIES.find((candidate) => candidate.key === key);
  if (!entry) {
    throw new Error(`Unknown master-data catalog key '${key}'`);
  }
  return entry;
};
