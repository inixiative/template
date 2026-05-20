// Unified logger surface every adapter implements. Matches pino's ILogger
// (Baileys etc. expect this shape). Adapters are dumb execution sinks — the
// `log` facade composes args + ALS scopes, then fans pre-formatted output to
// each adapter. `child` is in the type to satisfy ILogger but every adapter
// throws — direct callers to `logScope(id, fn)` (our ALS-bound scoping). SDKs
// that genuinely need pino's child semantics import `pinoLogger` directly.
export type LoggerAdapter = {
  level: string;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  fatal: (...args: unknown[]) => void;
  trace: (...args: unknown[]) => void;
  // Consola-only cosmetics — backends without native equivalents map to info.
  success: (...args: unknown[]) => void;
  box: (...args: unknown[]) => void;
  child: (bindings?: Record<string, unknown>) => LoggerAdapter;
};

export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'success' | 'box';
