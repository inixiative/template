/**
 * Pure functions for persisting and restoring paginated data state
 * to/from history.state and URL search params.
 */

export type PersistedState = {
  page?: number;
  pageSize?: number;
  search?: string;
  orderBy?: string[];
};

/** URL param names for each state field. */
const URL_PARAMS: Record<keyof PersistedState, string> = {
  page: 'page',
  pageSize: 'pageSize',
  search: 'search',
  orderBy: 'orderBy',
};

/** Sync a PersistedState to URL search params. Falsy/default values are removed. */
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

/** Read PersistedState from URL search params. Pass searchString for testing. */
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

/** Read initial state from history.state, falling back to URL params. */
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

/** Write state to history.state under the given key. */
export function writeToHistoryState(key: string, state: PersistedState): void {
  try {
    const historyState = { ...window.history.state, [key]: state };
    window.history.replaceState(historyState, '');
  } catch {
    // sandboxed iframe or SecurityError
  }
}

/** Write state to both history.state and URL search params in one replaceState call. */
export function writeToHistoryStateAndUrl(key: string | undefined, state: PersistedState): void {
  try {
    const url = syncStateToUrl(state);
    const historyState = key
      ? { ...window.history.state, [key]: state }
      : window.history.state;
    window.history.replaceState(historyState, '', url);
  } catch {
    // sandboxed iframe or SecurityError
  }
}

/** Parse "field:direction" strings back to orderBy objects. */
export function parseOrderByStrings(
  strings: string[],
): Array<{ field: string; direction: 'asc' | 'desc' }> {
  return strings.map((s) => {
    const [field, direction] = s.split(':');
    return { field, direction: direction as 'asc' | 'desc' };
  });
}
