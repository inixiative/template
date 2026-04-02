# FE-002: Editor Slice Pattern

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-04-02
**Updated**: 2026-04-02

---

## Overview

Add a `makeEditorSlice(name)` factory that generates standardized editor slices for form/model editing state. All editor slices share a base interface (records map, set/update/remove actions, isDirty tracking). This gives every create/edit form in the app a consistent, composable state shape with zero boilerplate.

## Objectives

- Establish a reusable editor slice factory with a stable base interface
- Make it trivial to add new editor slices (inquiry, inquiry response, etc.)

---

## Design

### Base Interface

Every editor slice has this exact structure:

```ts
{
  // state — model map keyed by ID ('new' for create, uuid for existing)
  records: {
    'new':       { data: {...}, isDirty: false },
    'uuid-123':  { data: {...}, isDirty: true  },
  },

  // actions — flat at the slice root
  set: (id, data) => ...,
  update: (id, patch) => ...,
  remove: (id) => ...,
}
```

- **`records`** — keyed map of model objects. `'new'` for create, uuid for existing.
- **`records[id].data`** — the model data (form fields).
- **`records[id].isDirty`** — `true` when data has been modified from its initial/server state.
- **`set`** — replace a record entirely (initial load from API, or re-set to clear dirty). Sets `isDirty: false`.
- **`update`** — patch a record (form field changes). Sets `isDirty: true`.
- **`remove`** — delete a record from the map (navigation away, cleanup).

**Why no `isLoading`/`hasFetched`?** TanStack Query already tracks fetch state. The editor slice is purely form state — it receives data via `set` after a query resolves.

**Why no `reset`?** Just `set` again with the original data (clears dirty), or `remove` + let the next navigation re-`set`. One less action to maintain.

### Factory

`makeEditorSlice(name)` generates a complete slice from the base interface. Only override when an editor needs custom actions beyond base CRUD.

```ts
export const makeEditorSlice = (name) => (set) => ({
  [name]: {
    records: {},

    set: (id, data) =>
      set(
        (state) => ({
          [name]: {
            ...state[name],
            records: {
              ...state[name].records,
              [id]: { data, isDirty: false },
            },
          },
        }),
        false,
        `${name}/set`,
      ),

    update: (id, patch) =>
      set(
        (state) => {
          const existing = state[name].records[id];
          if (!existing) return state;
          return {
            [name]: {
              ...state[name],
              records: {
                ...state[name].records,
                [id]: {
                  data: { ...existing.data, ...patch },
                  isDirty: true,
                },
              },
            },
          };
        },
        false,
        `${name}/update`,
      ),

    remove: (id) =>
      set(
        (state) => {
          const { [id]: _, ...rest } = state[name].records;
          return { [name]: { ...state[name], records: rest } };
        },
        false,
        `${name}/remove`,
      ),
  },
});
```

### Custom Actions (Extension Pattern)

Slices that need extra actions beyond the base spread the factory and extend:

```ts
export const createInquiryEditorSlice = (set, get, store) => ({
  ...makeEditorSlice('inquiryEditor')(set, get, store),
  inquiryEditor: {
    ...makeEditorSlice('inquiryEditor')(set, get, store).inquiryEditor,
    duplicate: (sourceId, newId) =>
      set(
        (state) => {
          const source = state.inquiryEditor.records[sourceId];
          if (!source) return state;
          return {
            inquiryEditor: {
              ...state.inquiryEditor,
              records: {
                ...state.inquiryEditor.records,
                [newId]: {
                  data: { ...source.data, name: `${source.data.name} (copy)` },
                  isDirty: true,
                },
              },
            },
          };
        },
        false,
        'inquiryEditor/duplicate',
      ),
  },
});
```

### Store Composition

```ts
// store/index.ts
export const useAppStore = create(
  devtools(
    (...a) => ({
      ...createInquiryEditorSlice(...a),
      ...createInquiryResponseEditorSlice(...a),
    }),
    { name: 'AppStore', enabled: process.env.ENVIRONMENT !== 'production' },
  ),
);
```

### Selector Hooks

```ts
import { useShallow } from 'zustand/react/shallow';

// Whole editor — useShallow for object selectors
export const useInquiryEditor = () => useAppStore(useShallow((s) => s.inquiryEditor));

// Single record by ID — useShallow for object
export const useInquiry = (id) => useAppStore(useShallow((s) => s.inquiryEditor.records[id]));

// Primitive selector — no useShallow needed
export const useIsInquiryDirty = (id) => useAppStore((s) => s.inquiryEditor.records[id]?.isDirty ?? false);
```

---

## Tasks

### 1. Factory & Types

- [ ] Create `packages/ui/src/store/makeEditorSlice.ts` with the factory function
- [ ] Define `EditorRecord<T>` type (`{ data: T; isDirty: boolean }`) and `EditorSlice<T>` type
- [ ] Export from `packages/ui/src/store/index.ts`

### 2. First Consumer: Inquiry Editor

- [ ] Create `slices/inquiryEditor.ts` using `makeEditorSlice('inquiryEditor')`
- [ ] Compose into the app store
- [ ] Add selector hooks (`useInquiryEditor`, `useInquiry`, `useIsInquiryDirty`)

### 3. Documentation

- [ ] Update `docs/claude/ZUSTAND.md` with Editor Slice section
- [ ] Document: base interface, factory usage, custom action extension pattern, selector hooks, re-render optimization

---

## Placement Decision

**Open question:** Where does `makeEditorSlice` live?

- **Option A: `packages/ui/src/store/`** — alongside existing shared slice creators. Makes it available to all apps. This is the natural home if editor slices are a shared pattern.
- **Option B: App-local `store/`** — if only one app needs editor slices initially, keep it local and promote later.

Recommendation: **Option A** — the factory is generic and app-agnostic, same as the existing slice creators.

## Open Questions

- Should `makeEditorSlice` live in `packages/ui` (shared) or app-local initially?
- Should editor slice types be generic over the model data shape (`EditorSlice<InquiryData>`) or use `unknown` for flexibility?

---

## Planned Editor Slices (Future)

| Slice | Purpose |
|-------|---------|
| `inquiryEditor` | Inquiry source-side editing (structure, fields, rules) — first consumer |
| `inquiryResponseEditor` | Inquiry target-side editing (filling out / responding to an inquiry) |

---

## Definition of Done

- [ ] `makeEditorSlice` factory exists and is exported
- [ ] TypeScript types for `EditorRecord<T>` (`{ data: T; isDirty: boolean }`) and `EditorSlice<T>`
- [ ] At least one editor slice composed into an app store
- [ ] Selector hooks exported with `useShallow` where appropriate
- [ ] DevTools action names work (`sliceName/actionName`)
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

_Origin: brainstorm session (2026-04-02) — Zealot identified the repeating editor state pattern. Factory approach eliminates boilerplate while keeping each editor independently composable. Simplified from original spec: dropped `isLoading`/`hasFetched` (TanStack Query's job) and `reset` (just re-`set`). Inquiry needs two separate editors — source side vs target/response side._
