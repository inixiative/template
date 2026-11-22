/**
 * @atlas
 * @kind hook, component
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { type QueryFunctionContext, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contactInfo,
  inquiryInfo,
  segmentInfo,
  settingInfo,
  webhookSubscriptionInfo,
} from '@template/sdk';
import type { SettingCatalog } from '@template/shared/settings';
import { apiQuery } from '@template/ui/lib/apiQuery';
import {
  inFlightMasterDataPreload,
  preloadMasterData,
} from '@template/ui/lib/masterData/preloadMasterData';
import {
  MASTER_DATA_GC_TIME,
  MASTER_DATA_STALE_TIME,
  type MasterDataKey,
  masterDataEntryFor,
} from '@template/ui/lib/masterData/registry';
import type { SdkFunction } from '@template/ui/lib/sdkTypes';
import { useAppStore } from '@template/ui/store';
import { useEffect } from 'react';

/**
 * Triggers the batched `/api/v1/*\/info` master-data preload once on authenticated mount.
 * Safe under React StrictMode (concurrent mounts share one in-flight batch request).
 */
export const usePreloadMasterData = (enabled = true): void => {
  const queryClient = useQueryClient();
  const spoofUserEmail = useAppStore((state) => state.auth.spoofUserEmail);
  const twoFactorAction = useAppStore((state) => state.auth.twoFactorAction);

  useEffect(() => {
    if (!enabled || twoFactorAction) return;
    void preloadMasterData(queryClient, { spoofUserEmail });
  }, [enabled, queryClient, spoofUserEmail, twoFactorAction]);
};

/**
 * Render as a sibling before `<Outlet />` in authenticated layouts so its effect fires before
 * child route queries mount and deduplicates initial `/info` requests into one batch call.
 */
export const MasterDataPreloader = ({ enabled = true }: { enabled?: boolean }) => {
  usePreloadMasterData(enabled);
  return null;
};

const useMasterDataQuery = <TFn extends SdkFunction>(key: MasterDataKey, fn: TFn) => {
  const queryClient = useQueryClient();
  const { queryKey } = masterDataEntryFor(key);
  const fallback = apiQuery(fn);

  return useQuery({
    queryKey,
    queryFn: async (context: QueryFunctionContext) => {
      const inFlight = inFlightMasterDataPreload(queryClient);
      if (inFlight) {
        await inFlight;
        const seeded = queryClient.getQueryData<Awaited<ReturnType<typeof fallback>>>(queryKey);
        if (seeded !== undefined) return seeded;
      }
      return fallback(context);
    },
    staleTime: MASTER_DATA_STALE_TIME,
    gcTime: MASTER_DATA_GC_TIME,
  });
};

export const useContactInfo = () =>
  useMasterDataQuery('contact', (opts: Parameters<typeof contactInfo>[0]) => contactInfo(opts));

export const useInquiryInfo = () =>
  useMasterDataQuery('inquiry', (opts: Parameters<typeof inquiryInfo>[0]) => inquiryInfo(opts));

export const useSegmentInfo = () =>
  useMasterDataQuery('segment', (opts: Parameters<typeof segmentInfo>[0]) => segmentInfo(opts));

export const useSettingInfo = () =>
  useMasterDataQuery('setting', (opts: Parameters<typeof settingInfo>[0]) => settingInfo(opts));

export const useSettingCatalog = () => {
  const query = useSettingInfo();
  const catalog = query.data?.data?.types as SettingCatalog | undefined;
  return { ...query, catalog };
};

export const useWebhookSubscriptionInfo = () =>
  useMasterDataQuery('webhookSubscription', (opts: Parameters<typeof webhookSubscriptionInfo>[0]) =>
    webhookSubscriptionInfo(opts),
  );
