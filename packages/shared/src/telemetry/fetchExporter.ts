/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { type ExportResult, ExportResultCode } from '@opentelemetry/core';

export const createFetchExporter = <T>(options: {
  signal?: 'logs' | 'traces' | 'metrics';
  url: string;
  headers?: Record<string, string>;
  serialize: (data: T) => Uint8Array | undefined;
  timeoutMs?: number;
}) => {
  const pending = new Set<Promise<void>>();
  let stopped = false;
  let lastWarning = 0;
  // Runtime allowlist too: no caller-supplied label or destination reaches diagnostics.
  const signal = ['logs', 'traces', 'metrics'].includes(options.signal ?? '')
    ? options.signal
    : 'unknown';
  const forceFlush = async () => {
    await Promise.allSettled([...pending]);
  };
  return {
    export(data: T, callback: (result: ExportResult) => void): void {
      const send = async (): Promise<ExportResult> => {
        let httpStatus: number | undefined;
        try {
          if (stopped) throw new Error('Exporter stopped');
          const body = options.serialize(data);
          if (!body) return { code: ExportResultCode.SUCCESS };
          const response = await fetch(options.url, {
            method: 'POST',
            redirect: 'error',
            headers: { ...options.headers, 'content-type': 'application/json' },
            body: new TextDecoder().decode(body),
            signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
          });
          httpStatus = response.status;
          await response.body?.cancel().catch(() => {});
          if (!response.ok) throw new Error('Collector rejected export');
          return { code: ExportResultCode.SUCCESS };
        } catch {
          if (Date.now() - lastWarning > 60_000) {
            lastWarning = Date.now();
            // Bypass the application logger to avoid exporting this failure recursively.
            // Never include URLs, headers, payloads, response bodies or caught errors.
            console.warn(
              JSON.stringify({
                event: 'telemetry.export.failed',
                level: 'warn',
                message: 'Telemetry export failed. Application continues.',
                signal,
                ...(httpStatus === undefined ? {} : { httpStatus }),
              }),
            );
          }
          return { code: ExportResultCode.FAILED, error: new Error('OTLP export failed') };
        }
      };
      const task = send().then(callback);
      pending.add(task);
      void task.finally(() => pending.delete(task)).catch(() => {});
    },
    forceFlush,
    async shutdown() {
      stopped = true;
      await forceFlush();
    },
  };
};
