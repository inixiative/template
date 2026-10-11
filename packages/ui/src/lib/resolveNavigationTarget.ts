/**
 * @atlas
 * @kind helper
 * @partOf primitive:ui
 * @uses primitive:flows
 */
import { FLOW_SEARCH_PARAM } from '@template/ui/lib/flows/flowSearchParam';
import {
  buildPathWithSearch,
  pickSearchParams,
  readSearchParam,
} from '@template/ui/lib/searchParams';

export type NavigationPolicy = 'context' | 'flow' | 'spoof' | 'all';

export type CurrentLocation = {
  search: string;
  hash: string;
  spoofUserEmail: string | null;
};

export type NavigationTarget = {
  pathname: string;
  hash: string;
  search?: Record<string, string>;
};

const preservedKeysByPolicy: Record<Exclude<NavigationPolicy, 'all'>, readonly string[]> = {
  context: ['org', 'space'],
  flow: ['org', 'space', FLOW_SEARCH_PARAM],
  spoof: [],
};

const searchToRecord = (params: URLSearchParams): Record<string, string> => {
  const record: Record<string, string> = {};
  params.forEach((value, key) => {
    record[key] = value;
  });
  return record;
};

const resolveSearchForPolicy = (
  current: CurrentLocation,
  policy: NavigationPolicy,
): Record<string, string> | undefined => {
  if (policy === 'all') {
    const search = searchToRecord(new URLSearchParams(current.search));
    return Object.keys(search).length > 0 ? search : undefined;
  }

  const preserved = pickSearchParams(current.search, preservedKeysByPolicy[policy]);
  const spoof = current.spoofUserEmail ?? readSearchParam(current.search, 'spoof');

  if (!preserved && !spoof) return undefined;

  const search = { ...(preserved || {}) };
  if (spoof) search.spoof = spoof;
  return search;
};

export const resolveNavigationTarget = (
  to: string,
  policy: NavigationPolicy,
  current: CurrentLocation,
): NavigationTarget => {
  const url = new URL(to, 'http://localhost');
  const merged = {
    ...searchToRecord(url.searchParams),
    ...(resolveSearchForPolicy(current, policy) || {}),
  };
  const search = Object.keys(merged).length > 0 ? merged : undefined;
  return { pathname: url.pathname, hash: url.hash || current.hash, search };
};

export const navigationTargetHref = (target: NavigationTarget): string =>
  buildPathWithSearch(target.pathname, target.search, target.hash);
