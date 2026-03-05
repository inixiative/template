# Design System KPI Baseline

Baseline captured on March 3, 2026.

## Commands

```bash
grep -rn --include="*.tsx" -E "(#[0-9a-fA-F]{3,6}|rgb\()" apps/ packages/ui/src/pages/ | wc -l
grep -rn "<Label" packages/ui/src/ apps/ | wc -l
grep -rn "<Table" packages/ui/src/ apps/ | wc -l
```

## Results

- hardcoded colors in apps + UI pages: `0`
- `<Label` usages (proxy for forms not yet migrated to `FormField`): `23`
- `<Table` usages (proxy for list views not yet migrated to `DataTable`): `10`

## Notes

- These values are rollout baseline numbers and should be tracked monthly.
- Targets:
  - `<Label` usage trending toward `0` in migrated flows.
  - `<Table` usage trending toward `0` where `DataTable` replacement applies.
