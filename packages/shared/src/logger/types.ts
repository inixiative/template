/**
 * @atlas
 * @kind type
 * @partOf primitive:shared
 * @uses none
 */
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
