/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import {
  type CheckOptions,
  type Condition,
  check,
  exposedSurface,
  type Lens,
  type LensNarrowing,
  sourceValuesFromRows,
  stampCoercions,
} from '@inixiative/json-rules';
import { useMemo, useState } from 'react';

export type FilteredData<T> = {
  /** Rows matching the current rule. */
  data: T[];
  rule: Condition;
  setRule: (rule: Condition) => void;
  /**
   * Builder-facing surface of the (narrowed) lens with sourced fields'
   * options materialized from the rows. Undefined when no lens is passed.
   */
  surface: Lens | undefined;
};

/**
 * Client-side filtering over an already-fetched collection, in the same rule
 * language the server uses (json-rules `check`). Pass a lens (usually
 * `lensFromOperation(operationId)`, optionally narrowed with picks/omits/sources)
 * to get a rules-builder surface whose pseudo-enum option sets come from the rows
 * themselves. `lens` and `options` must be referentially stable (memoize them) —
 * a fresh narrowing literal per render recomputes the surface every render. Rules
 * whose lens carries `{bind}` clauses need `options.bindings`.
 */
export const useFilteredData = <T extends Record<string, unknown>>(
  rows: readonly T[],
  lens?: Lens | LensNarrowing,
  options?: CheckOptions,
): FilteredData<T> => {
  const [rule, setRule] = useState<Condition>(true);

  // Rules are coercion-stamped from the lens before evaluation, so widget-authored
  // values (date strings, stringified numbers) match wire-format rows.
  const stamped = useMemo(() => (lens ? stampCoercions(rule, lens) : rule), [rule, lens]);

  const data = useMemo(() => rows.filter((row) => check(stamped, row, options) === true), [rows, stamped, options]);

  const surface = useMemo(
    () => (lens ? exposedSurface(lens, { sourceValues: sourceValuesFromRows(lens, rows, options) }) : undefined),
    [lens, rows, options],
  );

  return { data, rule, setRule, surface };
};
