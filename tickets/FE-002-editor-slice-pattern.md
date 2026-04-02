# FE-002: Editor Slice Pattern

**Status**: 🆕 Not Started
**Assignee**: Unassigned
**Priority**: Medium
**Created**: 2026-04-02
**Updated**: 2026-04-02

---

## Overview

Add a `makeEditorSlice(name)` factory that generates standardized editor slices for form/model editing state. All editor slices share a base interface (records map, set/update/reset/remove actions, isDirty tracking). This gives every create/edit form in the app a consistent, composable state shape with zero boilerplate.

## Objectives

- Establish a reusable editor slice factory with a stable base interface
- Refactor existing mission editor state to use the factory
- Make it trivial to add new editor slices (rewards, segments, fan users, etc.)

---

## Design

### Base Interface

Every editor slice has this exact structure:

```ts
{
  // state — model map keyed by ID ('new' for create, uuid for existing)
  records: {
    'new':       { data: {...}, isLoading: false, hasFetched: false, isDirty: false },
    'uuid-123':  { data: {...}, isLoading: false, hasFetched: true,  isDirty: true  },
  },

  // actions — flat at the slice root
  set: (id, data) => ...,
  update: (id, patch) => ...,
  reset: (id) => ...,
  remove: (id) => ...,
}
```

- **`records`** — keyed map of model objects. `'new'` for create, uuid for existing.
- **`records[id].data`** — the model data (form fields).
- **`records[id].isDirty`** — `true` when data has been modified from its initial/server state.
- **`set`** — replace a record entirely (initial load from API). Sets `isDirty: false`.
- **`update`** — patch a record (form field changes). Sets `isDirty: true`.
- **`reset`** — clear to blank (`'new'`) or re-fetch from API (existing). Sets `isDirty: false`.
- **`remove`** — delete a record from the map (navigation away, cleanup).

### Factory

`makeEditorSlice(name)` generates a complete slice from the base interface. Only override when an editor needs custom actions beyond base CRUD.

```ts
const initialRecord = { data: null, isLoading: false, hasFetched: false, isDirty: false };

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
              [id]: { data, isLoading: false, hasFetched: true, isDirty: false },
            },
          },
        }),
        false,
        `${name}/set`,
      ),

    update: (id, patch) =>
      set(
        (state) => {
          const existing = state[name].records[id] || initialRecord;
          return {
            [name]: {
              ...state[name],
              records: {
                ...state[name].records,
                [id]: {
                  ...existing,
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

    reset: (id) =>
      set(
        (state) => ({
          [name]: {
            ...state[name],
            records: {
              ...state[name].records,
              [id]: { ...initialRecord },
            },
          },
        }),
        false,
        `${name}/reset`,
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

Slices that need extra actions beyond base CRUD spread the factory and extend:

```ts
export const createSegmentEditorSlice = (set, get, store) => ({
  ...makeEditorSlice('segmentEditor')(set, get, store),
  segmentEditor: {
    ...makeEditorSlice('segmentEditor')(set, get, store).segmentEditor,
    duplicate: (sourceId, newId) =>
      set(
        (state) => {
          const source = state.segmentEditor.records[sourceId];
          return {
            segmentEditor: {
              ...state.segmentEditor,
              records: {
                ...state.segmentEditor.records,
                [newId]: {
                  ...source,
                  data: { ...source.data, name: `${source.data.name} (copy)` },
                  isDirty: true,
                },
              },
            },
          };
        },
        false,
        'segmentEditor/duplicate',
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
      ...createMissionEditorSlice(...a),
      ...createRewardsEditorSlice(...a),
    }),
    { name: 'AdminDashboardStore', enabled: process.env.ENVIRONMENT !== 'production' },
  ),
);
```

### Selector Hooks

```ts
import { useShallow } from 'zustand/react/shallow';

// Whole editor — useShallow for object selectors
export const useMissionEditor = () => useAppStore(useShallow((s) => s.missionEditor));

// Single record by ID — useShallow for object
export const useMission = (id) => useAppStore(useShallow((s) => s.missionEditor.records[id]));

// Primitive selector — no useShallow needed
export const useIsMissionDirty = (id) => useAppStore((s) => s.missionEditor.records[id]?.isDirty ?? false);
```

---

## Tasks

### 1. Factory & Types

- [ ] Create `packages/ui/src/store/makeEditorSlice.ts` with the factory function
- [ ] Define `EditorRecord<T>` and `EditorSlice<T>` types (generic over model data shape)
- [ ] Export from `packages/ui/src/store/index.ts`

### 2. First Consumer: Mission Editor

- [ ] Create `slices/missionEditor.ts` using `makeEditorSlice('missionEditor')`
- [ ] Compose into the app store (admin or whichever app owns missions)
- [ ] Add selector hooks (`useMissionEditor`, `useMission`, `useIsMissionDirty`)
- [ ] Refactor existing mission create/edit state to use the new slice

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
- Does the admin app need its own `store/index.ts` created as part of this ticket, or is that a separate concern?
- Should editor slice types be generic over the model data shape (`EditorSlice<MissionData>`) or use `unknown`/`any` for maximum flexibility?
- Is the Workflows/Store.ts migration (into app store) in scope or a separate ticket?

---

## Planned Editor Slices (Future)

| Slice | Purpose |
|-------|---------|
| `missionEditor` | Mission create/edit (first consumer) |
| `rewardsEditor` | Reward create/edit |
| `segmentEditor` | Segment create/edit (will need custom `duplicate` action) |
| `fanUserEditor` | Fan user profile editing |
| `inquiryTemplateEditor` | Inquiry template/definition editing (admin side — structure, fields, rules) |
| `inquiryResponseEditor` | Inquiry response/submission editing (user side — filling out an inquiry) |

---

## Definition of Done

- [ ] `makeEditorSlice` factory exists and is exported
- [ ] TypeScript types for `EditorRecord<T>` and `EditorSlice<T>`
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

_Origin: brainstorm session (2026-04-02) — Zealot identified the repeating editor state pattern across mission/rewards/segment/fan-user forms. Factory approach eliminates boilerplate while keeping each editor independently composable._
