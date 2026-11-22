/**
 * @atlas
 * @kind type, hook
 * @partOf primitive:ui
 * @uses none
 */
export type RoutingSearchParams = {
  organizationId: string | null;
  spaceId: string | null;
  spoofEmail: string | null;
  flowId: string | null;
};

export type UrlSearchParamUpdates = Partial<
  Record<'org' | 'space' | 'spoof' | 'flow', string | null>
>;
