/**
 * @atlas
 * @kind utils
 * @partOf primitive:shared
 * @uses none
 */
const MAX_PAGES = 1000;

export type PageRequest = { page: number; cursor: string | null };

type DefaultPaginatedResponse<T> = {
  data?: T[] | null;
  pagination?: { totalPages?: number | null; nextCursor?: string | null } | null;
  error?: unknown;
};

export type FetchAllPagesCap = { reason: 'maxPages' | 'maxRows'; returned: number };

type FetchAllPagesOptions<R, T> = {
  getItems?: (response: R) => T[];
  getNextCursor?: (response: R) => string | null;
  hasMore?: (response: R, request: PageRequest, items: T[]) => boolean;
  maxPages?: number;
  maxRows?: number;
  onCapped?: (cap: FetchAllPagesCap) => void;
  isError?: (response: R) => unknown;
  onResponse?: (response: R, request: PageRequest) => void;
};

// why: a truthy `error` field must fail the walk, otherwise a 401/500 reads as an empty page.
const defaultIsError = (response: unknown): unknown =>
  response && typeof response === 'object' && 'error' in response
    ? (response as { error?: unknown }).error
    : undefined;

const defaultGetItems = <T>(response: DefaultPaginatedResponse<T>): T[] => response.data ?? [];

const defaultGetNextCursor = <T>(response: DefaultPaginatedResponse<T>): string | null =>
  response.pagination?.nextCursor ?? null;

const defaultHasMore = <T>(
  response: DefaultPaginatedResponse<T>,
  { page, cursor }: PageRequest,
  items: T[],
): boolean => {
  if (items.length === 0) return false;
  if (cursor) return true;
  return page < (response.pagination?.totalPages ?? page);
};

export const fetchAllPages = async <T, R = DefaultPaginatedResponse<T>>(
  fetchPage: (request: PageRequest) => Promise<R>,
  options?: FetchAllPagesOptions<R, T>,
): Promise<T[]> => {
  const getItems = options?.getItems ?? (defaultGetItems as (response: R) => T[]);
  const getNextCursor =
    options?.getNextCursor ?? (defaultGetNextCursor as (response: R) => string | null);
  const hasMore =
    options?.hasMore ??
    (defaultHasMore as (response: R, request: PageRequest, items: T[]) => boolean);
  const maxPages = options?.maxPages ?? MAX_PAGES;
  const maxRows = options?.maxRows ?? Number.POSITIVE_INFINITY;
  const isError = options?.isError ?? (defaultIsError as (response: R) => unknown);

  const items: T[] = [];
  let request: PageRequest = { page: 1, cursor: null };

  while (request.page <= maxPages) {
    const response = await fetchPage(request);

    const requestError = isError(response);
    if (requestError) {
      const message =
        typeof requestError === 'object' && requestError !== null && 'message' in requestError
          ? String((requestError as { message?: unknown }).message)
          : undefined;
      throw new Error(`fetchAllPages: page ${request.page} failed${message ? `: ${message}` : ''}`);
    }

    options?.onResponse?.(response, request);

    const batch = getItems(response);
    items.push(...batch);

    const next: PageRequest = { page: request.page + 1, cursor: getNextCursor(response) };
    const another = hasMore(response, { page: request.page, cursor: next.cursor }, batch);
    if (items.length >= maxRows) {
      const truncated = items.length > maxRows || another;
      items.length = maxRows;
      if (truncated) options?.onCapped?.({ reason: 'maxRows', returned: items.length });
      break;
    }
    if (!another) break;
    if (request.page >= maxPages) {
      options?.onCapped?.({ reason: 'maxPages', returned: items.length });
      break;
    }
    request = next;
  }

  return items;
};
