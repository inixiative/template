/**
 * @atlas
 * @kind helper
 * @partOf primitive:flows
 * @uses none
 */
export type FlowParticipation = false | 'complete';

export const isFlowCompleting = ({
  flow,
  type,
  variant,
}: {
  flow?: FlowParticipation;
  type?: string;
  variant?: string | null;
}): boolean => {
  if (flow === false) return false;
  if (flow === 'complete') return true;
  return type === 'submit' || variant == null || variant === 'default';
};
