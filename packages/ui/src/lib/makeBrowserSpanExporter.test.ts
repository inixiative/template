import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { ExportResultCode } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  type ReadableSpan,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base';
import { makeBrowserSpanExporter } from '@template/ui/lib/makeBrowserSpanExporter';

const recordedSpans = (): ReadableSpan[] => {
  const memory = new InMemorySpanExporter();
  const tracer = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(memory)],
  }).getTracer('test');
  tracer.startSpan('browser.error').end();
  return memory.getFinishedSpans();
};

const exportOnce = (exporter: ReturnType<typeof makeBrowserSpanExporter>) =>
  new Promise<ExportResultCode>((resolve) =>
    exporter.export(recordedSpans(), (result) => resolve(result.code)),
  );

describe('makeBrowserSpanExporter', () => {
  afterEach(() => {
    mock.restore();
  });

  it('stops exporting after three failed exports in a row, and a success resets the count', async () => {
    const statuses = [503, 503, 202, 503, 503, 503];
    const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(
      (async () =>
        new Response(null, { status: statuses.shift() ?? 503 })) as unknown as typeof fetch,
    );
    const onExportsStopped = mock(() => {});
    const exporter = makeBrowserSpanExporter({
      app: 'web',
      endpoint: 'https://api.example.test/api/telemetry/browser',
      onExportsStopped,
    });

    const results: ExportResultCode[] = [];
    for (let exportNumber = 0; exportNumber < 6; exportNumber++)
      results.push(await exportOnce(exporter));

    expect(results).toEqual([
      ExportResultCode.FAILED,
      ExportResultCode.FAILED,
      ExportResultCode.SUCCESS,
      ExportResultCode.FAILED,
      ExportResultCode.FAILED,
      ExportResultCode.FAILED,
    ]);
    expect(onExportsStopped).toHaveBeenCalledTimes(1);
    expect(await exportOnce(exporter)).toBe(ExportResultCode.FAILED);
    expect(fetchSpy).toHaveBeenCalledTimes(6);
  });

  it('counts a request that never reaches the endpoint as a failure', async () => {
    spyOn(globalThis, 'fetch').mockImplementation((async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch);
    const onExportsStopped = mock(() => {});
    const exporter = makeBrowserSpanExporter({
      app: 'web',
      endpoint: 'https://api.example.test/api/telemetry/browser',
      onExportsStopped,
    });

    for (let exportNumber = 0; exportNumber < 3; exportNumber++) await exportOnce(exporter);

    expect(onExportsStopped).toHaveBeenCalledTimes(1);
  });
});
