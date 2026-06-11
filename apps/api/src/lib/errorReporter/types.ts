/**
 * @atlas
 * @kind type
 * @partOf infrastructure:observability
 */
export type ErrorContext = {
  extra?: Record<string, unknown>;
};

export type ErrorReporter = {
  captureException: (err: unknown, context?: ErrorContext) => void;
};
