# FE-002: Editor Slice Pattern

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-04-02
**Updated**: 2026-04-02

---

## Overview

A single `editors` slice containing typed sub-editors. Each editor is a named sub-namespace under `state.editors.*`, all sharing the same base record shape and actions. `makeEditorSlice<T>(name, set)` generates one editor namespace with the model type passed directly as a generic.

## Objectives

- Single `editors` slice with typed sub-editors
- `makeEditorSlice<T>` takes the model type directly — no indirection
- `state.editors.` autocomplete shows all composed editors
- Trivial to add new editors — one `makeEditorSlice` call + one `EditorsSlice` entry

---

## Design

### Types

No registry. Each `makeEditorSlice` call declares its own model type directly:

```ts
type EditorRecord<T> = {
  data: T;
  isDirty: boolean;
};

type EditorOptions<T> = {
  defaultData?: T;  // blank state for 'new' records — if provided, set('new') uses this
};

type EditorNamespace<T> = {
  records: Record<string, EditorRecord<T>>;
  set: (id: 'new' | string, data?: T) => void;   // data optional when defaultData configured
  update: (id: string, patch: Partial<T>) => void; // throws if id not in records
  remove: (id: string) => void;                     // throws if id not in records
};
```

**Key constraints:**
- **IDs must be `'new'` or UUID v7.** Validated at runtime — other keys throw.
- **`update` throws if record doesn't exist.** You must `set` first. This prevents silent bugs where an update targets a stale/missing record.
- **`remove` throws if record doesn't exist.** Same reasoning — if you're removing something that isn't there, something is wrong.
- **Duplicate `set('new', ...)`** overwrites the previous `'new'` record. Caller's responsibility to guard against this if needed.

**Why no `isLoading`/`hasFetched`?** TanStack Query already tracks fetch state. The editor slice is purely form state — it receives data via `set` after a query resolves.

### EditorsSlice Type

Each app defines its own `EditorsSlice` based on which editors it composes:

```ts
type EditorsSlice = {
  editors: {
    inquiry: EditorNamespace<InquiryData>;
    inquiryResponse: EditorNamespace<InquiryResponseData>;
  };
};
```

### State Shape

```ts
state.editors.inquiry.records['new']        // { data: InquiryData, isDirty: false }
state.editors.inquiry.records['uuid-123']   // { data: InquiryData, isDirty: true }
state.editors.inquiryResponse.records['uuid-456']  // { data: InquiryResponseData, isDirty: false }
```

### Actions

Each editor namespace gets three actions:

- **`set(id, data?)`** — replace a record entirely (initial load from API, or re-set to clear dirty). Sets `isDirty: false`. ID must be `'new'` or UUID v7. If `defaultData` configured, `data` is optional for `'new'`.
- **`update(id, patch)`** — shallow-merge patch into record data. Sets `isDirty: true`. **Throws if record doesn't exist** — must `set` first.
- **`remove(id)`** — delete a record from the map. **Throws if record doesn't exist.**

```ts
// Load from API — UUID v7 key
state.editors.inquiry.set('0192d4e0-...', inquiryData);

// User edits a field
state.editors.inquiry.update('0192d4e0-...', { title: 'New title' });

// Navigate away — cleanup
state.editors.inquiry.remove('0192d4e0-...');

// Create mode — 'new' key, uses defaultData if configured
state.editors.inquiry.set('new');

// Create mode — explicit data
state.editors.inquiry.set('new', blankInquiry);

// ❌ Throws — invalid key (not 'new' or UUID v7)
state.editors.inquiry.set('foo', data);

// ❌ Throws — record doesn't exist yet
state.editors.inquiry.update('0192d4e0-...', { title: 'x' });

// ❌ Throws — record doesn't exist
state.editors.inquiry.remove('nonexistent');

// ⚠️ Overwrites — duplicate set('new') replaces previous
state.editors.inquiry.set('new', data1);
state.editors.inquiry.set('new', data2);  // data1 gone
```

### Factory

`makeEditorSlice(name, set)` generates a single editor namespace — one entry under `editors.*`. Each editor calls it independently:

```ts
const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertValidId = (id: string) => {
  if (id !== 'new' && !UUID_V7_RE.test(id)) {
    throw new Error(`Editor: invalid key "${id}" — must be 'new' or UUID v7`);
  }
};

const makeEditorSlice = <T>(
  name: string,
  set: StoreApi<AppStore>['setState'],
  options?: EditorOptions<T>,
): EditorNamespace<T> => ({
  records: {},

  set: (id, data?) => {
    assertValidId(id);
    const resolved = data ?? options?.defaultData;
    if (resolved === undefined) {
      throw new Error(`Editor ${name}: set('${id}') called without data and no defaultData configured`);
    }
    set(
      (state) => ({
        editors: {
          ...state.editors,
          [name]: {
            ...state.editors[name],
            records: {
              ...state.editors[name].records,
              [id]: { data: resolved, isDirty: false },
            },
          },
        },
      }),
      false,
      `editors/${name}/set`,
    );
  },

  update: (id, patch) => {
    set(
      (state) => {
        const existing = state.editors[name].records[id];
        if (!existing) {
          throw new Error(`Editor ${name}: update('${id}') — record not found. Call set() first.`);
        }
        return {
          editors: {
            ...state.editors,
            [name]: {
              ...state.editors[name],
              records: {
                ...state.editors[name].records,
                [id]: {
                  data: { ...existing.data, ...patch },
                  isDirty: true,
                },
              },
            },
          },
        };
      },
      false,
      `editors/${name}/update`,
    );
  },

  remove: (id) => {
    set(
      (state) => {
        if (!state.editors[name].records[id]) {
          throw new Error(`Editor ${name}: remove('${id}') — record not found.`);
        }
        const { [id]: _, ...rest } = state.editors[name].records;
        return {
          editors: {
            ...state.editors,
            [name]: { ...state.editors[name], records: rest },
          },
        };
      },
      false,
      `editors/${name}/remove`,
    );
  },
});
```

### Editors Slice (Composition)

The `editors` slice assigns each `makeEditorSlice` result to its key, passing the type directly:

```ts
export const createEditorsSlice: StateCreator<AppStore, [], [], EditorsSlice> = (set) => ({
  editors: {
    inquiry: makeEditorSlice<InquiryData>('inquiry', set, {
      defaultData: { title: '', fields: [], rules: [] },  // set('new') uses this
    }),
    inquiryResponse: makeEditorSlice<InquiryResponseData>('inquiryResponse', set),
  },
});
```

Adding a new editor = one `makeEditorSlice<T>` call + one `EditorsSlice` type entry.

### Store Composition

```ts
// store/index.ts
export const useAppStore = create(
  devtools(
    (...a) => ({
      ...createAuthSlice(...a),
      ...createEditorsSlice(...a),
      ...createTenantSlice(...a),
      // ...
    }),
    { name: 'AppStore' },
  ),
);
```

### Selector Hooks

```ts
import { useShallow } from 'zustand/react/shallow';

// Single record by ID — useShallow for object
export const useEditorRecord = <K extends keyof EditorsSlice['editors']>(name: K, id: string) =>
  useAppStore(useShallow((s) => s.editors[name].records[id]));

// Primitive selector — no useShallow needed
export const useIsEditorDirty = <K extends keyof EditorsSlice['editors']>(name: K, id: string) =>
  useAppStore((s) => s.editors[name].records[id]?.isDirty ?? false);

// All records for an editor — useShallow for object
export const useEditorRecords = <K extends keyof EditorsSlice['editors']>(name: K) =>
  useAppStore(useShallow((s) => s.editors[name].records));

// Actions for an editor — stable references, no useShallow needed
export const useEditorActions = <K extends keyof EditorsSlice['editors']>(name: K) =>
  useAppStore(
    useShallow((s) => ({
      set: s.editors[name].set,
      update: s.editors[name].update,
      remove: s.editors[name].remove,
    })),
  );
```

### Custom Actions (Future)

Deferred — base CRUD covers initial needs. When needed, options include:
- Extend a specific editor namespace after creation
- Add a second registry layer for editors that need custom actions
- Or just add helper functions outside the store that compose base actions

### DevTools

Action names auto-namespace: `editors/inquiry/set`, `editors/inquiryResponse/update`, etc.

---

## Tasks

### 1. Types

- [ ] Define `EditorRecord<T>`, `EditorNamespace<T>` generic types
- [ ] Define app-level `EditorsSlice` type listing composed editors

### 2. Slice Implementation

- [ ] Create `packages/ui/src/store/slices/editors.ts` with `makeEditorSlice(name, set)` factory
- [ ] Create `createEditorsSlice` that composes `makeEditorSlice` calls under `state.editors.*`
- [ ] Export from `packages/ui/src/store/index.ts`

### 3. Store Composition & Hooks

- [ ] Compose `makeEditorSlice` into app store(s)
- [ ] Add generic selector hooks (`useEditorRecord`, `useIsEditorDirty`, `useEditorRecords`, `useEditorActions`)

### 4. Documentation

- [ ] Update `docs/claude/ZUSTAND.md` with Editors Slice section
- [ ] Document: registry pattern, adding new editors, selector hooks, DevTools naming

---

## Open Questions

- Custom actions pattern — deferred, but worth spiking when a real need arises.

---

## Planned Editor Slices (Future)

| Slice | Purpose |
|-------|---------|
| `inquiryEditor` | Inquiry source-side editing (structure, fields, rules) — first consumer |
| `inquiryResponseEditor` | Inquiry target-side editing (filling out / responding to an inquiry) |

---

## Definition of Done

- [ ] `makeEditorSlice(name, set)` factory + `createEditorsSlice` compositor exist
- [ ] TypeScript types: `EditorRecord<T>`, `EditorNamespace<T>`, app-level `EditorsSlice`
- [ ] At least two editors composed (`inquiry`, `inquiryResponse`)
- [ ] Generic selector hooks exported with `useShallow` where appropriate
- [ ] DevTools action names work (`editors/inquiry/set`, etc.)
- [ ] `docs/claude/ZUSTAND.md` updated
- [ ] `bun run check` passes

---

## Resources

- Zustand docs: slice pattern — https://docs.pmnd.rs/zustand/guides/slices-pattern
- Existing shared slices: `packages/ui/src/store/slices/`
- Existing store compositions: `apps/web/app/store/index.ts`, `apps/superadmin/src/store/index.ts`
- Architecture doc: `docs/claude/ZUSTAND.md`

---

## Related Tickets

- [FE-001: TanStack Start Migration](./FE-001-web-tanstack-start-evaluation.md) — store may need adjustments for SSR

---

## Comments

_Origin: brainstorm session (2026-04-02). Simplified from original spec: dropped `isLoading`/`hasFetched` (TanStack Query's job), dropped `reset` (just re-`set`). Evolved from per-editor root slices → single `editors` slice with registry → direct generic `makeEditorSlice<T>` (no registry indirection). Custom actions deferred._
