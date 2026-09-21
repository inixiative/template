/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { type ExportResult, ExportResultCode } from '@opentelemetry/core';

export const createFetchExporter = <T>(options: {
  url: string;
  headers?: Record<string, string>;
  serialize: (data: T) => Uint8Array | undefined;
  timeoutMs?: number;
}) => {
  const pending = new Set<Promise<void>>();
  let stopped = false;
  let lastWarning = 0;
  const forceFlush = async () => {
    await Promise.allSettled([...pending]);
  };
  return {
    export(data: T, callback: (result: ExportResult) => void): void {
      const send = async (): Promise<ExportResult> => {
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
          await response.body?.cancel();
          if (!response.ok) throw new Error('Collector rejected export');
          return { code: ExportResultCode.SUCCESS };
        } catch {
          if (Date.now() - lastWarning > 60_000) {
            lastWarning = Date.now();
            console.warn(
              'Telemetry export failed; check collector connectivity and credentials. Application continues.',
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
