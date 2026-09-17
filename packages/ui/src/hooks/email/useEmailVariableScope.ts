/**
 * @atlas
 * @kind hook
 * @partOf feature:email
 * @uses none
 */
import type { Lens, SourceValues } from '@inixiative/json-rules';
import {
  type LensLoopOption,
  type LensValueOption,
  lensScopeSurface,
  type RuleBuilderSource,
  resolve,
} from '@inixiative/rules-builder';
import { kebabCase } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';

export type EmailScopeFrame = { eachPath: string; binding: string; loop: LensLoopOption };

export type EmailVariableRow =
  | { type: 'value'; path: string; snippet: string; value: LensValueOption }
  | { type: 'loop'; path: string; loop: LensLoopOption };

const bindingFor = (loop: LensLoopOption, taken: ReadonlySet<string>): string => {
  const base = kebabCase(loop.path.split('.').at(-1) ?? 'item') || 'item';
  let candidate = base;
  for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
};

const wrapInEaches = (frames: EmailScopeFrame[], inner: string): string =>
  frames.reduceRight((body, frame) => `{{#each ${frame.eachPath} as=${frame.binding}}}${body}{{/each}}`, inner);

export const useEmailVariableScope = (
  source: RuleBuilderSource | undefined,
  sourceValues: SourceValues[] = [],
  enclosingBindings: readonly string[] = [],
) => {
  const lens = useMemo<Lens | undefined>(
    () => (source ? resolve(source, { sourceValues }) : undefined),
    [source, sourceValues],
  );
  const [frames, setFrames] = useState<EmailScopeFrame[]>([]);

  const rows = useMemo<EmailVariableRow[]>(() => {
    if (!lens) return [];
    const frame = frames.at(-1);
    const scope = frame
      ? lensScopeSurface(lens, { mapName: frame.loop.relation.mapName, model: frame.loop.relation.modelName })
      : lensScopeSurface(lens);
    const prefix = frame ? `${frame.binding}.` : '';
    const loops = scope.loops.map<EmailVariableRow>((loop) => ({ type: 'loop', path: `${prefix}${loop.path}`, loop }));
    const values = scope.values.map<EmailVariableRow>((value) => {
      const path = `${prefix}${value.path}`;
      return { type: 'value', path, snippet: wrapInEaches(frames, `{{${path}}}`), value };
    });
    return [...loops, ...values];
  }, [lens, frames]);

  const enter = useCallback(
    (loop: LensLoopOption) => {
      setFrames((current) => {
        const frame = current.at(-1);
        const taken = new Set([...current.map((entry) => entry.binding), ...enclosingBindings]);
        const eachPath = frame ? `${frame.binding}.${loop.path}` : loop.path;
        return [...current, { eachPath, binding: bindingFor(loop, taken), loop }];
      });
    },
    [enclosingBindings],
  );

  const leave = useCallback(() => setFrames((current) => current.slice(0, -1)), []);
  const reset = useCallback(() => setFrames([]), []);

  return { lens, frames, rows, enter, leave, reset };
};
