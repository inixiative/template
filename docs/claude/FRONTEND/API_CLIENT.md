# Frontend API Client and Data Hooks

<!-- toc:start -->

## Contents

- [Generated SDK](#generated-sdk)
- [apiQuery and apiMutation](#apiquery-and-apimutation)
  - [Context Queries](#context-queries)
- [Optimistic Mutations](#optimistic-mutations)
- [Data Hooks](#data-hooks)
  - [Architecture](#architecture)
  - [makeDataConfig](#makedataconfig)
  - [usePaginatedData — Page-Number Pagination](#usepaginateddata--page-number-pagination)
  - [useInfiniteData — Infinite Scroll](#useinfinitedata--infinite-scroll)
  - [Table and Pagination](#table-and-pagination)
  - [Scroll Restoration — useScrollState](#scroll-restoration--usescrollstate)
  - [Section Hash — useSectionHash](#section-hash--usesectionhash)
  - [Infinite Scroll Trigger — useInfiniteScrollTrigger](#infinite-scroll-trigger--useinfinitescrolltrigger)
  - [State Persistence](#state-persistence)
- [Form Helpers](#form-helpers)
  - [useDebounce](#usedebounce)
  - [useValidateUniqueness](#usevalidateuniqueness)
- [Testing](#testing)
- [Key Files](#key-files)

<!-- toc:end -->

How the apps call apps/api: the generated SDK, the fetch wrappers, optimistic mutations, and the server-data hooks behind tables and feeds. See [FRONTEND.md](../FRONTEND.md) for the index.

## Generated SDK

The API client is a standalone package, `@template/sdk`, generated from the OpenAPI spec by hey-api (`@hey-api/openapi-ts`). It emits `sdk.gen.ts` (operations), `types.gen.ts`, `schemas.gen.ts`, and TanStack Query helpers (`@tanstack/react-query.gen.ts`, e.g. `organizationReadQueryKey`), all re-exported from `@template/sdk`.

```bash
bun run --cwd packages/sdk generate:sdk  # regenerate from openapi.gen.json
# or refresh spec + regenerate in one step:
bash scripts/generate-sdk.sh
```

**Location:** `packages/sdk/src/`

It lives outside `@template/ui` so non-UI consumers can call apps/api without importing a UI package. Route and spec generation: [API_ROUTES.md](../API_ROUTES.md).

## apiQuery and apiMutation

**Location:** `packages/ui/src/lib/apiQuery.ts`, `apiMutation.ts`, `apiFetchInternal.ts`

Both wrap an SDK call in `apiFetchInternal`, which:

- adds `Authorization: Bearer <token>` and `x-spoof-user-email` when spoofing;
- points the client at `VITE_API_URL`, fills `:id` path params, and bracket-encodes nested query params (`serializeBracketQuery`);
- throws on error responses by default;
- unwraps the API envelope: `{ data: { data, pagination } }` → `{ data, pagination }`.

`apiQuery(fn)` returns a `queryFn`. It reads the request options from `queryKey[0]`, so pair it with the SDK's generated query key:

```typescript
import { organizationRead, organizationReadQueryKey } from '@template/sdk';
import { useQuery } from '@template/ui/hooks';
import { apiQuery } from '@template/ui/lib';

const { data } = useQuery({
  queryKey: organizationReadQueryKey({ path: { id } }),
  queryFn: apiQuery((opts: Parameters<typeof organizationRead>[0]) => organizationRead(opts)),
});
```

`apiMutation(fn)` returns a `mutationFn` that takes the request options as its variables:

```typescript
import { organizationCreate } from '@template/sdk';
import { apiMutation } from '@template/ui/lib/apiMutation';

const mutation = useMutation({
  mutationFn: apiMutation((opts: Parameters<typeof organizationCreate>[0]) =>
    organizationCreate(opts),
  ),
});

await mutation.mutateAsync({ body: { name, slug } });
```

### Context Queries

A page that shows the same list in user, organization and space contexts maps each context to its query once with `makeContextQueries` (`packages/ui/src/lib/makeContextQueries.ts`):

```typescript
export const sentInquiryContextQueries = makeContextQueries<InquiryQueryParams>()({
  user: (_args, params) =>
    query({
      queryKey: meSentManyInquiriesQueryKey({ query: params?.query }),
      queryFn: apiQuery((opts: Parameters<typeof meSentManyInquiries>[0]) => meSentManyInquiries(opts)),
    }),
  organization: ({ organization }, params) => query({ /* organizationSentManyInquiries */ }),
  space: ({ space }, params) => query({ /* spaceSentManyInquiries */ }),
});

const slot = sentInquiryContextQueries(tenant.context, { query });
```

A context with no entry throws. Existing maps: `lib/{token,webhook,integration,segment}ContextQueries.ts`, `lib/inquiries/contextQueries.ts`.

## Optimistic Mutations

**Location:** `packages/ui/src/hooks/useOptimisticMutation.ts`

**Every mutation is optimistic by default.** A create, update, delete or request (an inquiry) from the UI goes through `useOptimisticMutation`, so the screen changes at once and rolls back on error. A plain `useMutation` needs a stated reason, for example a mutation whose result can't be predicted before the server answers. Write the reason beside it in the PR, not in a comment. Inquiry mutations have their own optimistic hooks in `packages/ui/src/hooks/inquiry/` (`useCreateInquiryMutation`, `useResolveInquiryMutation`, …).

Why: the user sees the change instantly, and one wrapper owns snapshot, rollback, reconcile and invalidation, so pages don't each hand-roll `onSuccess: invalidate`.

`useOptimisticMutation({ mutationFn, targets, mutationOptions? })` applies each target's `optimisticUpdate` to its query on mutate, rolls back on error, runs the target's `reconcile` with the response on success, and invalidates the target query on settle (unless `invalidateOnSettled: false`). `targets` can be a function of the variables.

For list queries, `createOptimisticListTarget({ queryKey, operation, optimisticExtras?, itemFromResponse? })` builds the target. `operation` is `'create' | 'update' | 'delete'`; the item id comes from `variables.path.id`, the fields from `variables.body`. A create inserts a placeholder row and replaces it with the response item.

```typescript
const deleteMutation = useOptimisticMutation({
  mutationFn: apiMutation((opts: Parameters<typeof organizationDelete>[0]) => organizationDelete(opts)),
  targets: [createOptimisticListTarget({ queryKey: listQueryKey, operation: 'delete' })],
});

deleteMutation.mutate({ path: { id: org.id } });
```

## Data Hooks

Server data primitives for search, filter, sort, pagination, infinite scroll, scroll restoration, and section navigation. These hooks are presentation-agnostic — they work with Table, card grids, feeds, or any renderer.

### Architecture

```
makeDataConfig(operationId)     → DataConfig (searchable fields, orderable fields, enums)
    ↓
useDataFilters(config)          → shared search/filter/sort state + filterQuery
    ↓
usePaginatedData({ config })    → filters + page/pageSize + scroll restore + URL sync
useInfiniteData({ config })     → filters + TanStack infinite query + scroll restore
    ↓
Table / Pagination / any renderer
```

Supporting hooks (used internally or standalone):
- `useScrollState` — per-element scroll position in history.state
- `useSectionHash` — root-level URL hash ↔ visible section sync
- `useInfiniteScrollTrigger` — IntersectionObserver sentinel for load-more
- `useInfiniteDataQuery` — low-level TanStack Query infinite wrapper

### makeDataConfig

Builds the data configuration from the OpenAPI spec's query metadata.

**Location:** `packages/ui/src/lib/makeDataConfig.ts`

```typescript
import { makeDataConfig } from '@template/ui/lib/makeDataConfig';

const config = makeDataConfig('adminOrganizationReadMany');
// { searchableFields, orderableFields, enumFilters, defaultOrderBy, canSearch, canOrder }

makeDataConfig('operationId', {
  defaultOrderBy: [{ field: 'createdAt', direction: 'desc' }],
  canSearch: false, // default: true when the operation has searchable fields
  canOrder: true,
});
```

### usePaginatedData — Page-Number Pagination

```typescript
import { usePaginatedData } from '@template/ui/hooks';

const data = usePaginatedData({
  config: makeDataConfig('adminOrganizationReadMany'),
  sectionId: 'orgs',          // scroll restore + section hash
  shareableUrl: true,          // ?page=3&search=acme in URL
});

<Table
  columns={columns}
  data={items}
  keyExtractor={(o) => o.id}
  pagination={data.paginationProps(total)}
  {...data.layoutProps}
/>
```

Options: `config`, `sectionId?`, `shareableUrl?`, `scrollRestore?`, `defaultPageSize?`. Returns: `search`, `filters`, `orderBy`, `page`, `pageSize`, `setSearch`, `setFilter`, `toggleOrderBy`, `setPage`, `setPageSize`, `reset`, `query`, `paginationProps(total, pageSizeOptions?)`, `layoutProps`, `sectionId`, `scrollRef`.

### useInfiniteData — Infinite Scroll

```typescript
import { useInfiniteData } from '@template/ui/hooks';

const feed = useInfiniteData({
  config: makeDataConfig('adminOrganizationReadMany'),
  queryKey: ['orgs'],
  queryFn: (page, filterQuery) => fetchOrgPage({ ...filterQuery, page }), // returns one page
  sectionId: 'orgFeed',
});

<Table
  columns={columns}
  data={feed.data}
  keyExtractor={(a) => a.id}
  infiniteScroll={feed.infiniteScrollProps}
  {...feed.layoutProps}
/>
```

Returns the filter state plus `data`, `pageCount`, `total`, `isLoading`, `isError`, `isFetchingNextPage`, `hasNextPage`, `fetchNextPage`, `infiniteScrollProps`, `layoutProps`.

### Table and Pagination

`Table` (`packages/ui/src/components/primitives/Table.tsx`) is a dumb renderer. It takes either `pagination` (fixed pages) or `infiniteScroll` (`{ onLoadMore, hasMore, isLoading }`), plus optional `maxHeight` + `scrollRef` (viewport scroll with a sticky header), `sectionId`, and `onRowClick`. Each `<tr>` gets `data-key={keyExtractor(item)}` for deep linking via `#usersTable.usr_abc123`. Props: [COMPONENTS.md](COMPONENTS.md#table).

`Pagination` (`packages/ui/src/components/primitives/Pagination.tsx`):

```typescript
<Pagination
  currentPage={3}
  totalPages={10}
  onPageChange={setPage}
  totalRecords={200}
  pageSize={20}
  pageSizeOptions={[10, 20, 50, 100]}
  onPageSizeChange={setPageSize}
/>
```

Numbered page buttons with ellipsis collapse, first/last/prev/next, a per-page selector, and a "Showing X–Y of Z" record count.

### Scroll Restoration — useScrollState

**Location:** `packages/ui/src/hooks/useScrollState.ts`

Persists scroll position to `history.state` per element. Back/forward restores position. Fresh navigation starts at top.

```typescript
// Viewport container:
const scrollRef = useRef<HTMLDivElement>(null);
useScrollState({ id: 'usersTable', scrollRef });

// Window scroll:
useScrollState({ id: 'mainFeed' });

// With data loading:
useScrollState({ id: 'table', scrollRef, ready: !isLoading });

// Disable:
useScrollState({ id: 'table', enabled: false });
```

### Section Hash — useSectionHash

**Location:** `packages/ui/src/hooks/useSectionHash.ts`

Mount once at the app root. Auto-discovers `data-section` elements via MutationObserver. Updates URL hash to the most visible section.

```typescript
// App root:
const { activeSection, scrollToSection } = useSectionHash();

// Any component — just add the attribute:
<section data-section="teamMembers">...</section>
```

Deep linking with dot notation:
- `#usersTable` → scrolls to `[data-section="usersTable"]`
- `#usersTable.usr_abc123` → scrolls to `[data-key="usr_abc123"]` within that section
- `#usersTable.3` → scrolls to the 4th `[data-key]` child (0-indexed fallback)

Use camelCase for section IDs (they become URL hash fragments). `useSectionOpen(sectionId)` returns `[open, setOpen]` for a collapsible section tied to the hash.

### Infinite Scroll Trigger — useInfiniteScrollTrigger

**Location:** `packages/ui/src/hooks/useInfiniteScrollTrigger.ts`

IntersectionObserver sentinel. Works with viewport containers and window scroll.

```typescript
const sentinelRef = useInfiniteScrollTrigger({
  onLoadMore: fetchNextPage,
  hasMore: true,
  isLoading: false,
  rootMargin: '200px',
});

<div>
  {items.map(item => <Card key={item.id} />)}
  <div ref={sentinelRef} />
</div>
```

### State Persistence

| State | Where | When |
|-------|-------|------|
| page, pageSize, search, orderBy | `history.state` (always) | Back/forward nav |
| page, pageSize, search, orderBy | URL params (opt-in `shareableUrl`) | Shared links |
| scroll position | `history.state` per `scroll:{id}` | Back/forward nav |
| section hash | URL `#hash` | Deep linking |

`history.state` is per history entry. Multiple data views on one page each get independent keys (`data:usersTable`, `scroll:usersTable`, etc.).

## Form Helpers

### useDebounce

**Location:** `packages/ui/src/hooks/useDebounce.ts`

Debounce only inputs that hit the backend (a network search, a fetch-triggering field). In-memory filtering of an already-loaded list stays undebounced.

```typescript
const debouncedSlug = useDebounce(slug, 300);
const search = useDebouncedCallback((query: string) => setQuery(query), 300); // has .cancel()
```

### useValidateUniqueness

**Location:** `packages/ui/src/hooks/useValidateUniqueness.ts`

Checks whether an organization or space value is taken by reading it through the `lookup` query param; a 404 means available.

```typescript
const { isAvailable, isChecking } = useValidateUniqueness('organization', 'slug', debouncedSlug, {
  excludeId: org?.id,
});

<Button disabled={!isAvailable || isChecking}>Create</Button>
```

`CreateOrganizationModal` combines both: it derives the slug from the name until edited, debounces it, and shows checking / available / taken.

## Testing

Run from `packages/ui` (requires `bunfig.toml` for happy-dom preload):

```bash
cd packages/ui && bun run test
```

Or via root: `bun run test:fe`. Data hook coverage lives next to the code: `makeDataConfig.test.ts`, `useDataFilters.test.ts`, `usePaginatedData.test.ts`, `useInfiniteDataQuery.test.ts`, `useInfiniteScrollTrigger.test.ts`, `Pagination.test.ts`, `useOptimisticMutation.test.ts`, `apiFetchInternal.test.ts`; bracket encoding in `@template/shared/bracketQuery`.

## Key Files

- `packages/sdk/src/` — generated client
- `packages/ui/src/lib/{apiQuery,apiMutation,apiFetchInternal,makeContextQueries,makeDataConfig}.ts`
- `packages/ui/src/hooks/useOptimisticMutation.ts`
- `packages/ui/src/hooks/{useDataFilters,usePaginatedData,useInfiniteData,useInfiniteDataQuery,useInfiniteScrollTrigger,useScrollState,useSectionHash}.ts`
- `packages/ui/src/hooks/{useDebounce,useValidateUniqueness}.ts`
- `packages/ui/src/components/primitives/{Table,Pagination}.tsx`
