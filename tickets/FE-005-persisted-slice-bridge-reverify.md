# FE-005: Persisted Slice — Cache-Bridge + Reverify Pattern

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-08-17
**Updated**: 2026-08-17

---

## Overview

A canonical Zustand pattern for client state that must survive a reload **without** becoming a second source of truth: **persist → rehydrate → reverify from API.** The persisted-and-hydrated snapshot is purely a **bridging stopgap** — it paints first, then the API confirms or corrects it. Delete the persistence entirely and correctness is unchanged; only first-paint flicker (and a first-request without context) returns.

This unifies the two conventions the stores already use in isolation:
- **In-memory + API-rehydrate** (the `currentUser`/auth slice) — the API is truth, but nothing survives a reload, so the first paint has no user/tenant and derives a fallback.
- **Hand-rolled `localStorage`** — survives reload, but becomes an untyped, multi-key source of truth that drifts from the API.

The pattern is: keep the API as the only truth, and let `zustand/middleware` `persist` be a typed, single-object cache that bridges the gap until reverify lands.

## Motivation

Downstream (Zealot advocate-portal, the multi-brand identity work) the session/user is spread across ~a dozen individual `localStorage` keys — `userId`, `userEmail`, `userIdSource`, `userUuid`, `brand`, `brandUuid`, `code`, … — read and written by hand in a React Context, disjoint from the store. It should be **one persisted `user`/`session` object off the slice**, and the hydrated copy should never be trusted past the first authoritative read. This ticket makes that the template's blessed shape so consumers stop hand-rolling it.

## Design

### The three phases

1. **persist** — on every state change, `persist` writes a `partialize`d snapshot (only the durable fields) to `createJSONStorage`. One object, typed, versioned.
2. **rehydrate** — on boot, `persist` synchronously loads the snapshot so the first render has data (no flicker, no context-less first request). The rehydrated value is marked **unverified**. If the snapshot's context disagrees with what the request names at boot, it is **discarded instead of painted** (see *Early escape* below).
3. **reverify** — immediately fire the authoritative API read; on resolve, overwrite the slice and mark **verified**. The API always wins. A cache/API mismatch corrects silently; the cache is never authoritative.

```ts
type Verified<T> = {
  data: T | null;
  /** false right after rehydrate, true once the API has confirmed this session. */
  isVerified: boolean;
  /** where the current `data` came from — 'cache' until reverify overwrites it. */
  source: 'cache' | 'api' | 'empty';
};
```

### Slice shape

```ts
export type SessionSlice = {
  session: Verified<User> & {
    /** called by the reverify query once /me resolves — becomes the source of truth. */
    confirm: (user: User) => void;
    /** reverify returned "no session" — clear, stay empty (not "not yet"). */
    reject: () => void;
    clear: () => void;
  };
};

export const createSessionSlice: StateCreator<
  AppStore,
  [['zustand/persist', unknown], ['zustand/devtools', never]],
  [],
  SessionSlice
> = (set) => ({
  session: {
    data: null,
    isVerified: false,
    source: 'empty',
    confirm: (user) =>
      set((s) => ({ session: { ...s.session, data: user, isVerified: true, source: 'api' } }), false, 'session/confirm'),
    reject: () =>
      set((s) => ({ session: { ...s.session, data: null, isVerified: true, source: 'empty' } }), false, 'session/reject'),
    clear: () =>
      set((s) => ({ session: { ...s.session, data: null, isVerified: false, source: 'empty' } }), false, 'session/clear'),
  },
});
```

### Store composition — `persist` wraps, `partialize` narrows

```ts
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (...a) => ({
        ...createSessionSlice(...a),
        ...createEditorsSlice(...a),
        // ...
      }),
      {
        name: 'app-session',
        storage: createJSONStorage(() => localStorage),
        version: 1,
        // ONLY the durable cache fields — never isVerified/source/actions.
        // contextTag rides along so rehydrate can detect a wrong-context snapshot.
        partialize: (s) => ({ session: { data: s.session.data, contextTag: s.session.contextTag } }),
        // rehydrated data is a cache, not truth: land it unverified — OR discard it
        // early if it belongs to a different context than this request names (see below).
        merge: (persisted, current) => {
          const cached = (persisted as any)?.session ?? {};
          const hint = syncContextHint();                 // from URL/host/query — no round trip
          const mismatch = hint != null && cached.contextTag != null && hint !== cached.contextTag;
          if (mismatch) return current;                   // early escape: start empty, reverify fills
          return {
            ...current,
            session: {
              ...current.session,
              data: cached.data ?? null,
              contextTag: cached.contextTag ?? null,
              isVerified: false,
              source: cached.data ? 'cache' : 'empty',
            },
          };
        },
      },
    ),
    { name: 'AppStore' },
  ),
);
```

### Early escape on context mismatch — kills the *other* flicker

The cache-bridge kills the blank→data flicker. It introduces the opposite one: if the persisted snapshot belongs to a **different context** than the current request declares (another brand / tenant / user), painting from it flashes the wrong context's content, and reverify then swaps it — a wrong→right flicker that's worse than a blank→right one, because the user briefly sees plausible-but-wrong data.

So rehydration is **guarded**. Persist a `contextTag` beside the data (the brand label/uuid the snapshot was resolved *for*). In `merge`, compare it against the context the request can name **synchronously at boot** — URL host / subdomain / query, the sources that don't need a round trip:

- **Mismatch** (hint present and disagrees with `contextTag`) → **escape early**: return empty, don't paint. Reverify populates the right context. No wrong-context flash.
- **No hint** (can't tell synchronously) → paint the cache best-effort; reverify still corrects.
- **Match** → paint the cache, unverified, as normal.

This is the first-class generalization of the URL-guard the Zealot hub slice already hand-rolls ("only rehydrate if the URL still names it"). In the template it lives in the bridge, not in each slice. `syncContextHint()` is supplied per app/slice — for brand identity it's the same synchronous `BrandSource` resolvers (URL/host/query) used elsewhere, so the boot guard and the runtime resolver share one vocabulary.

### Reverify — the query owns confirmation

`persist` rehydrates; it does not validate. Reverification is a normal TanStack Query against the authoritative endpoint, wired once at app root, that calls `confirm`/`reject`:

```ts
export const useReverifySession = () => {
  const { confirm, reject } = useAppStore(useShallow((s) => ({ confirm: s.session.confirm, reject: s.session.reject })));
  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const me = await getMe();          // authoritative
      me ? confirm(me) : reject();
      return me;
    },
  });
};
```

### Reading it — gate risky work on `isVerified`

- **Display** may read `data` immediately (cache is good enough to paint).
- **Anything with a correctness cost** (a write keyed on the cached identity, a brand-scoped request) waits for `isVerified` — the cached value may be a stale/other-context copy. This is the one rule that keeps the cache from silently becoming truth.

```ts
export const useSession = () => useAppStore(useShallow((s) => s.session.data));
export const useIsSessionVerified = () => useAppStore((s) => s.session.isVerified);
export const getSession = () => useAppStore.getState().session.data; // non-React call sites
```

### Why not just `persist` and trust it

Because the persisted copy is written from whatever the last session saw, and for multi-tenant / multi-brand identity that can be the *wrong* context's snapshot. Trusting it is exactly the drift that hand-rolled `localStorage` already causes. `persist` earns its place only as a bridge; `reverify` is what makes it safe.

---

## Tasks

### 1. Primitive

- [ ] `Verified<T>` type + `createSessionSlice` (or a generic `makeVerifiedSlice<T>(name, set)` if a second consumer appears)
- [ ] `persist` middleware wired into the store with `partialize` (durable fields only) + `merge` (land as `isVerified:false`, `source:'cache'`)
- [ ] Persist a `contextTag`; `merge` early-escapes to empty on context mismatch via a `syncContextHint()` (URL/host/query), preventing wrong-context flash
- [ ] `version` + a `migrate` stub so the cache shape can evolve without a poisoned rehydrate

### 2. Reverify

- [ ] `useReverifySession` (or generic reverify hook) wired at app root, calling `confirm`/`reject`
- [ ] `isVerified` gate documented as the rule for correctness-bearing reads

### 3. Selector hooks & non-React access

- [ ] `useSession`, `useIsSessionVerified`, `getSession` (getState for async/non-React call sites)

### 4. Documentation

- [ ] `docs/claude/ZUSTAND.md` — "Persisted Slice (cache-bridge + reverify)" section: the three phases, `partialize`/`merge`, the `isVerified` gate, and the explicit rule that the persisted layer is a stopgap, not a source of truth

---

## Definition of Done

- [ ] `persist`-wrapped store with a `partialize`d single-object cache (no scattered keys)
- [ ] Rehydrated state lands unverified and is overwritten by the API on reverify
- [ ] Context-mismatch early escape works: a snapshot from another context is discarded at boot, not painted
- [ ] `isVerified` gate exists and is documented for correctness-bearing reads
- [ ] Selector hooks + `getState` accessor exported
- [ ] `docs/claude/ZUSTAND.md` updated
- [ ] `bun run check` passes

---

## Resources

- Zustand persist middleware — https://docs.pmnd.rs/zustand/integrations/persisting-store-data
- Slice pattern — https://docs.pmnd.rs/zustand/guides/slices-pattern
- Existing slices: `packages/ui/src/store/slices/`
- Architecture doc: `docs/claude/ZUSTAND.md`

---

## Related Tickets

- [FE-002: Editor Slice Pattern](./FE-002-editor-slice-pattern.md) — same slice-composition + selector-hook conventions; editors are in-memory form state, this is persisted session state
- Zealot ZLT-4114 (FE brand-identity Zustand) is the first downstream consumer — it needs exactly this bridge for the hub brand and the session user

---

## Comments

_Origin: Zealot multi-brand identity review (2026-08-17). The advocate-portal session is spread across ~12 hand-rolled `localStorage` keys and a half-migrated brand slice that reads `localStorage` but doesn't own it. Aron: it should just be the user object off `zustand/persist` — "persist, rehydrate, and reverify from API, where the data persisted and hydrated is just purely a bridging stop gap." This ticket makes that the template's canonical pattern. Note: this would be the first `persist` use across the template + Zealot — the correct primitive for durable-but-not-authoritative client state, which nothing here has needed until multi-tenant identity._
