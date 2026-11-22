/**
 * @atlas
 * @kind utils
 * @partOf primitive:ui
 * @uses none
 */
export type ListPageState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

const URL_PARAMS: Record<keyof ListPageState, string> = {
  page: 'page',
  pageSize: 'pageSize',
  search: 'search',
  orderBy: 'orderBy',
};

export function currentUrlWithListStateParams(state: ListPageState): string {
  const url = new URL(window.location.href);

  for (const [key, param] of Object.entries(URL_PARAMS)) {
    const value = state[key as keyof ListPageState];

    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) {
      url.searchParams.delete(param);
    } else if (key === 'page' && value === 1) {
      url.searchParams.delete(param);
    } else if (Array.isArray(value)) {
      url.searchParams.delete(param);
      for (const v of value) url.searchParams.append(param, v);
    } else {
      url.searchParams.set(param, String(value));
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

// page/pageSize come off the URL (user-editable, shareable, stale). Reject NaN / non-positive so a
// hand-mangled `?page=abc` or `?page=-5` can't inject invalid pagination state.
function parsePositiveInt(value: string | null): number | undefined {
  if (value === null) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function listPageStateFromUrl(searchString?: string): ListPageState {
  const params = new URLSearchParams(searchString ?? window.location.search);
  const state: ListPageState = {};

  const page = parsePositiveInt(params.get('page'));
  if (page !== undefined) state.page = page;

  const pageSize = parsePositiveInt(params.get('pageSize'));
  if (pageSize !== undefined) state.pageSize = pageSize;

  const search = params.get('search');
  if (search) state.search = search;

  const orderBy = params.getAll('orderBy');
  if (orderBy.length > 0) state.orderBy = orderBy;

  return state;
}

export function initialListPageState(
  stateKey: string | undefined,
  checkUrl: boolean,
): ListPageState {
  if (typeof window === 'undefined') return {};

  if (stateKey) {
    try {
      const saved = window.history.state?.[stateKey];
      if (saved && typeof saved === 'object') {
        return saved as ListPageState;
      }
    } catch {
      // SSR or sandboxed iframe
    }
  }

  if (checkUrl) {
    const fromUrl = listPageStateFromUrl();
    if (Object.keys(fromUrl).length > 0) return fromUrl;
  }

  return {};
}

export function writeToHistoryState(key: string, state: ListPageState): void {
  try {
    const historyState = { ...window.history.state, [key]: state };
    window.history.replaceState(historyState, '');
  } catch {
    // sandboxed iframe or SecurityError
  }
}

export function writeToHistoryStateAndUrl(key: string | undefined, state: ListPageState): void {
  try {
    const url = currentUrlWithListStateParams(state);
    const historyState = key ? { ...window.history.state, [key]: state } : window.history.state;
    window.history.replaceState(historyState, '', url);
  } catch {
    // sandboxed iframe or SecurityError
  }
}

export function parseOrderByStrings(
  strings: string[],
): Array<{ field: string; direction: 'asc' | 'desc' }> {
  return strings.map((s) => {
    const [field, direction] = s.split(':');
    return { field, direction: direction === 'desc' ? 'desc' : 'asc' };
  });
}
