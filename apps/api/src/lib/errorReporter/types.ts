/**
 * @atlas
 * @kind type
 * @partOf infrastructure:observability
 * @uses none
 */
export type ErrorContext = {
  extra?: Record<string, unknown>;
};

export type ErrorReporter = {
  captureException: (err: unknown, context?: ErrorContext) => void;
};
