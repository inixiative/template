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
  it('reports signal and HTTP status, suppresses secrets and throttles repeated failures', async () => {
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
      for (const httpStatus of [401, 402, 403, 415, 429, 503]) {
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

  it('reports failures before a response with the signal and no status or raw error', async () => {
    const warnings: string[] = [];
    const warn = spyOn(console, 'warn').mockImplementation((value) => warnings.push(String(value)));
    const server = Bun.serve({ port: 0, fetch: () => new Promise<Response>(() => {}) });
    try {
      const timeout = createFetchExporter({
        signal: 'traces',
        url: server.url.toString(),
        timeoutMs: 20,
        serialize,
      });
      expect((await exportOnce(timeout)).code).toBe(ExportResultCode.FAILED);
      await timeout.shutdown();
      const transport = createFetchExporter({
        signal: 'metrics',
        url: 'not-a-url-secret',
        serialize,
      });
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
        expect.objectContaining({ signal: 'traces' }),
        expect.objectContaining({ signal: 'metrics' }),
        expect.objectContaining({ signal: 'unknown' }),
        expect.objectContaining({ signal: 'unknown' }),
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
