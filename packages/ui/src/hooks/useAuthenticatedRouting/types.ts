export type RoutingSearchParams = {
  organizationId: string | null;
  spaceId: string | null;
  spoofEmail: string | null;
};

export type UrlSearchParamUpdates = Partial<Record<'org' | 'space' | 'spoof', string | null>>;
