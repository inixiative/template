/**
 * @atlas
 * @partOf primitive:ui
 */
export type PersistedState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

const URL_PARAMS: Record<keyof PersistedState, string> = {
  page: 'page',
  pageSize: 'pageSize',
  search: 'search',
  orderBy: 'orderBy',
};

export function syncStateToUrl(state: PersistedState): string {
  const url = new URL(window.location.href);

  for (const [key, param] of Object.entries(URL_PARAMS)) {
    const value = state[key as keyof PersistedState];

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

export function readStateFromUrl(searchString?: string): PersistedState {
  const params = new URLSearchParams(searchString ?? window.location.search);
  const state: PersistedState = {};

  const page = params.get('page');
  if (page) state.page = Number.parseInt(page, 10);

  const pageSize = params.get('pageSize');
  if (pageSize) state.pageSize = Number.parseInt(pageSize, 10);

  const search = params.get('search');
  if (search) state.search = search;

  const orderBy = params.getAll('orderBy');
  if (orderBy.length > 0) state.orderBy = orderBy;

  return state;
}

export function readInitialState(stateKey: string | undefined, checkUrl: boolean): PersistedState {
  if (typeof window === 'undefined') return {};

  if (stateKey) {
    try {
      const saved = window.history.state?.[stateKey];
      if (saved && typeof saved === 'object') {
        return saved as PersistedState;
      }
    } catch {
      // SSR or sandboxed iframe
    }
  }

  if (checkUrl) {
    const fromUrl = readStateFromUrl();
    if (Object.keys(fromUrl).length > 0) return fromUrl;
  }

  return {};
}

export function writeToHistoryState(key: string, state: PersistedState): void {
  try {
    const historyState = { ...window.history.state, [key]: state };
    window.history.replaceState(historyState, '');
  } catch {
    // sandboxed iframe or SecurityError
  }
}

export function writeToHistoryStateAndUrl(key: string | undefined, state: PersistedState): void {
  try {
    const url = syncStateToUrl(state);
    const historyState = key ? { ...window.history.state, [key]: state } : window.history.state;
    window.history.replaceState(historyState, '', url);
  } catch {
    // sandboxed iframe or SecurityError
  }
}

export function parseOrderByStrings(strings: string[]): Array<{ field: string; direction: 'asc' | 'desc' }> {
  return strings.map((s) => {
    const [field, direction] = s.split(':');
    return { field, direction: direction as 'asc' | 'desc' };
  });
}
