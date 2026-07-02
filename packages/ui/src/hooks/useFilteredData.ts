/**
 * @atlas
 * @kind hook
 * @partOf primitive:ui
 * @uses none
 */
import { type Condition, check, exposedSurface, type Lens, type LensNarrowing } from '@inixiative/json-rules';
import { sourceValuesFromRows } from '@template/ui/lib/sourceValuesFromRows';
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
 * `lensFromSchema(<SdkResponseSchema>)`, optionally narrowed with picks/omits/
 * sources) to get a rules-builder surface whose pseudo-enum option sets come
 * from the rows themselves.
 */
export const useFilteredData = <T extends Record<string, unknown>>(
  rows: readonly T[],
  lens?: Lens | LensNarrowing,
): FilteredData<T> => {
  const [rule, setRule] = useState<Condition>(true);

  const data = useMemo(() => rows.filter((row) => check(rule, row) === true), [rows, rule]);

  const surface = useMemo(
    () => (lens ? exposedSurface(lens, { sourceValues: sourceValuesFromRows(lens, rows) }) : undefined),
    [lens, rows],
  );

  return { data, rule, setRule, surface };
};
