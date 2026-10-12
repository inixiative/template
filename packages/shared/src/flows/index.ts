/**
 * @atlas
 * @kind constant
 * @partOf primitive:shared
 * @uses none
 */
export const FlowStepAdvance = { auto: 'auto', confirm: 'confirm' } as const;
export type FlowStepAdvance = keyof typeof FlowStepAdvance;

export const FlowStepState = { done: 'done', pending: 'pending' } as const;
export type FlowStepState = keyof typeof FlowStepState;
