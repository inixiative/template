/**
 * @atlas
 * @kind test
 * @partOf infrastructure:observability
 * @uses none
 */
import { describe, expect, it, spyOn } from 'bun:test';
import { type ExportResult, ExportResultCode } from '@opentelemetry/core';
import { createFetchExporter } from '@template/shared/telemetry/fetchExporter';

const serialize = () => new TextEncoder().encode('{"private":"payload-secret"}');
const exportOnce = (exporter: ReturnType<typeof createFetchExporter>) =>
  new Promise<ExportResult>((resolve) => exporter.export({}, resolve));

describe('export failure diagnostics', () => {
  it('reports HTTP status and category, suppresses secrets and throttles repeated failures', async () => {
    const warnings: string[] = [];
    const warn = spyOn(console, 'warn').mockImplementation((value) => warnings.push(String(value)));
    const server = Bun.serve({
      port: 0,
      fetch: (request) =>
        new Response('response-secret', {
          status: Number(new URL(request.url).pathname.slice(1)),
          headers: { 'x-private': 'response-header-secret' },
        }),
    });
    try {
      for (const [httpStatus, category] of [
        [401, 'authentication'],
        [403, 'authentication'],
        [402, 'billing_or_quota'],
        [429, 'rate_limit'],
        [503, 'collector'],
        [415, 'http'],
      ] as const) {
        const exporter = createFetchExporter({
          url: `${server.url}${httpStatus}?private=url-secret`,
          headers: { Authorization: 'Bearer header-secret' },
          signal: 'logs',
          serialize,
        });
        const before = warnings.length;
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await exportOnce(exporter);
          expect(result.code).toBe(ExportResultCode.FAILED);
          expect(result.error?.message).toBe('OTLP export failed');
        }
        await exporter.shutdown();
        expect(warnings.length).toBe(before + 1);
        expect(JSON.parse(warnings[before]!)).toEqual({
          event: 'telemetry.export.failed',
          level: 'warn',
          message: 'Telemetry export failed. Application continues.',
          signal: 'logs',
          category,
          httpStatus,
        });
      }
      expect(warnings.join('\n')).not.toContain('secret');
      expect(warnings.join('\n')).not.toContain(server.url.host);
    } finally {
      warn.mockRestore();
      await server.stop(true);
    }
  });

  it('distinguishes timeout, transport, serialization and stopped failures without raw errors', async () => {
    const warnings: string[] = [];
    const warn = spyOn(console, 'warn').mockImplementation((value) => warnings.push(String(value)));
    const server = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
    try {
      const timeout = createFetchExporter({ signal: 'traces', url: server.url.toString(), timeoutMs: 20, serialize });
      expect((await exportOnce(timeout)).code).toBe(ExportResultCode.FAILED);
      await timeout.shutdown();
      const transport = createFetchExporter({ signal: 'metrics', url: 'not-a-url-secret', serialize });
      expect((await exportOnce(transport)).code).toBe(ExportResultCode.FAILED);
      await transport.shutdown();
      const serialization = createFetchExporter({
        url: server.url.toString(),
        serialize: () => {
          throw new Error('serializer-secret');
        },
      });
      expect((await exportOnce(serialization)).code).toBe(ExportResultCode.FAILED);
      await serialization.shutdown();
      const stopped = createFetchExporter({ url: server.url.toString(), serialize });
      await stopped.shutdown();
      expect((await exportOnce(stopped)).code).toBe(ExportResultCode.FAILED);
      expect(warnings.map((value) => JSON.parse(value))).toEqual([
        expect.objectContaining({ signal: 'traces', category: 'timeout' }),
        expect.objectContaining({ signal: 'metrics', category: 'transport' }),
        expect.objectContaining({ signal: 'unknown', category: 'serialization' }),
        expect.objectContaining({ signal: 'unknown', category: 'exporter_stopped' }),
      ]);
      expect(warnings.join('\n')).not.toContain('secret');
      expect(warnings.join('\n')).not.toContain('httpStatus');
    } finally {
      warn.mockRestore();
      await server.stop(true);
    }
  });

  it('keeps successful and empty exports quiet', async () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {});
    let requests = 0;
    const server = Bun.serve({
      port: 0,
      fetch: () => {
        requests++;
        return Response.json({});
      },
    });
    try {
      const exporter = createFetchExporter({ url: server.url.toString(), serialize });
      expect((await exportOnce(exporter)).code).toBe(ExportResultCode.SUCCESS);
      await exporter.shutdown();
      const empty = createFetchExporter({ url: server.url.toString(), serialize: () => undefined });
      expect((await exportOnce(empty)).code).toBe(ExportResultCode.SUCCESS);
      await empty.shutdown();
      expect(requests).toBe(1);
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      await server.stop(true);
    }
  });
});
