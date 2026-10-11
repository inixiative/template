/**
 * @atlas
 * @kind constant
 * @partOf primitive:flows
 * @uses none
 */
export const FLOW_MUTATION_META = { flowMutation: true } as const;

export const isFlowMutation = (meta: unknown): boolean =>
  typeof meta === 'object' && meta !== null && 'flowMutation' in meta;
