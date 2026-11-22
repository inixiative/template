/**
 * @atlas
 * @kind query
 * @partOf primitive:ui
 * @uses primitive:sdk
 */
import { useQuery } from '@tanstack/react-query';
import { settingInfo, settingInfoQueryKey } from '@template/sdk';
import type { SettingCatalog } from '@template/shared/settings';
import { apiQuery } from '@template/ui/lib/apiQuery';

/**
 * Cardi-style master-data hook for the setting catalog (`GET /api/v1/setting/info`).
 * Fetched once per session with infinite staleTime/gcTime and assembled client-side
 * with raw `Setting[]` rows via `assembleResourceSettings()`.
 */
export const useSettingInfo = () =>
  useQuery({
    queryKey: settingInfoQueryKey(),
    queryFn: apiQuery((opts: Parameters<typeof settingInfo>[0]) => settingInfo(opts)),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });

export const useSettingCatalog = () => {
  const query = useSettingInfo();
  const catalog = query.data?.data?.types as SettingCatalog | undefined;
  return { ...query, catalog };
};
