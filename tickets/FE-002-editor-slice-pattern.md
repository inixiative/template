# FE-002: Editor Slice Pattern

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-04-02
**Updated**: 2026-04-02

---

## Overview

A single `editors` slice with a type registry. Each editor is a named sub-namespace under `state.editors.*`, all sharing the same base record shape and actions. New editors are added by registering a name + model type — one store composition line regardless of editor count.

## Objectives

- Single `editors` slice with registry-driven sub-editors
- Type-safe per-editor via generic registry map (`name → ModelType`)
- `state.editors.` autocomplete shows all registered editors
- Trivial to add new editors — register a name, get full CRUD for free

---

## Design

### Type Registry

A registry maps editor names to their model types. This drives both the runtime shape and TypeScript inference:

```ts
// Editor registry — add new editors here
type EditorRegistry = {
  inquiry: InquiryData;
  inquiryResponse: InquiryResponseData;
};
```

### Record Shape

Every record in every editor has the same minimal shape:

```ts
type EditorRecord<T> = {
  data: T;
  isDirty: boolean;
};
```

**Why no `isLoading`/`hasFetched`?** TanStack Query already tracks fetch state. The editor slice is purely form state — it receives data via `set` after a query resolves.

### Slice Shape

```ts
// Per-editor namespace
type EditorNamespace<T> = {
  records: Record<string, EditorRecord<T>>;
  set: (id: string, data: T) => void;
  update: (id: string, patch: Partial<T>) => void;
  remove: (id: string) => void;
};

// The full editors slice — one namespace per registry entry
type EditorsSlice = {
  editors: {
    [K in keyof EditorRegistry]: EditorNamespace<EditorRegistry[K]>;
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

- **`set(id, data)`** — replace a record entirely (initial load from API, or re-set to clear dirty). Sets `isDirty: false`.
- **`update(id, patch)`** — shallow-merge patch into record data. Sets `isDirty: true`. No-ops if record doesn't exist.
- **`remove(id)`** — delete a record from the map (navigation away, cleanup).

```ts
// Load from API
state.editors.inquiry.set('uuid-123', inquiryData);

// User edits a field
state.editors.inquiry.update('uuid-123', { title: 'New title' });

// Navigate away — cleanup
state.editors.inquiry.remove('uuid-123');

// Create mode — 'new' as key
state.editors.inquiry.set('new', blankInquiry);
```

### Factory

`makeEditorSlice(name, set)` generates a single editor namespace — one entry under `editors.*`. Each editor calls it independently:

```ts
// makeEditorSlice — generates one editor namespace
const makeEditorSlice = <K extends keyof EditorRegistry>(
  name: K,
  set: StoreApi<AppStore>['setState'],
): EditorNamespace<EditorRegistry[K]> => ({
  records: {},

  set: (id, data) =>
    set(
      (state) => ({
        editors: {
          ...state.editors,
          [name]: {
            ...state.editors[name],
            records: {
              ...state.editors[name].records,
              [id]: { data, isDirty: false },
            },
          },
        },
      }),
      false,
      `editors/${name}/set`,
    ),

  update: (id, patch) =>
    set(
      (state) => {
        const existing = state.editors[name].records[id];
        if (!existing) return state;
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
    ),

  remove: (id) =>
    set(
      (state) => {
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
    ),
});
```

### Editors Slice (Composition)

The `editors` slice composes individual `makeEditorSlice` calls:

```ts
// createEditorsSlice — composes all editors under state.editors.*
export const createEditorsSlice: StateCreator<AppStore, [], [], EditorsSlice> = (set) => ({
  editors: {
    ...makeEditorSlice('inquiry', set),
    ...makeEditorSlice('inquiryResponse', set),
  },
});
```

Adding a new editor = one `makeEditorSlice` call + one `EditorRegistry` entry.

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
export const useEditorRecord = <K extends keyof EditorRegistry>(name: K, id: string) =>
  useAppStore(useShallow((s) => s.editors[name].records[id]));

// Primitive selector — no useShallow needed
export const useIsEditorDirty = <K extends keyof EditorRegistry>(name: K, id: string) =>
  useAppStore((s) => s.editors[name].records[id]?.isDirty ?? false);

// All records for an editor — useShallow for object
export const useEditorRecords = <K extends keyof EditorRegistry>(name: K) =>
  useAppStore(useShallow((s) => s.editors[name].records));

// Actions for an editor — stable references, no useShallow needed
export const useEditorActions = <K extends keyof EditorRegistry>(name: K) =>
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

### 1. Types & Registry

- [ ] Define `EditorRecord<T>`, `EditorNamespace<T>`, `EditorsSlice` types
- [ ] Define `EditorRegistry` type mapping editor names → model types
- [ ] First entries: `inquiry: InquiryData`, `inquiryResponse: InquiryResponseData`

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

- Should the `EditorRegistry` live in `packages/ui` (shared) or be defined per-app? If shared, all apps get all editors. If per-app, each app declares only the editors it needs but loses the single-source registry.
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
- [ ] TypeScript types: `EditorRecord<T>`, `EditorNamespace<T>`, `EditorsSlice`, `EditorRegistry`
- [ ] At least two editors registered (`inquiry`, `inquiryResponse`)
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

_Origin: brainstorm session (2026-04-02). Simplified from original spec: dropped `isLoading`/`hasFetched` (TanStack Query's job), dropped `reset` (just re-`set`). Evolved from per-editor root slices to single `editors` slice with type registry for discoverability (`state.editors.` autocomplete). Custom actions deferred._
