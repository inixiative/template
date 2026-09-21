/**
 * @atlas
 * @kind test
 * @partOf infrastructure:observability
 * @uses none
 */
import { describe, expect, it } from 'bun:test';
import { telemetrySettings } from './telemetrySettings';

describe('monitoring init settings', () => {
  it('generates concrete per-signal URLs for a combined OTLP collector', () => {
    const settings = telemetrySettings('kingdom', {
      mode: 'otlp',
      endpoint: ' https://collector.example.test:4318/otlp/ ',
      headers: 'Authorization=Bearer%20test-token',
    });
    for (const signal of ['logs', 'traces', 'metrics']) {
      expect(settings).toContainEqual({
        path: '/api',
        key: `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`,
        value: `https://collector.example.test:4318/otlp/v1/${signal}`,
      });
    }
    expect(
      settings.filter((setting) => /ENDPOINT$/.test(setting.key)).every((setting) => setting.value.length > 0),
    ).toBe(true);
  });

  it('splits destinations while keeping all credentials in the API secret path', () => {
    const settings = telemetrySettings('tribe', {
      mode: 'split',
      endpoint: 'https://otlp.nr-data.net',
      headers: 'api-key=nr-secret',
      logsEndpoint: 'https://source.betterstack.test/v1/logs',
      logsHeaders: 'Authorization=Bearer%20bs-secret',
      browser: true,
    });
    expect(settings).toContainEqual({
      path: '/api',
      key: 'OTEL_EXPORTER_OTLP_LOGS_HEADERS',
      value: 'Authorization=Bearer%20bs-secret',
    });
    expect(settings).toContainEqual({
      path: '/api',
      key: 'OTEL_EXPORTER_OTLP_LOGS_ENDPOINT',
      value: 'https://source.betterstack.test/v1/logs',
    });
    expect(settings).toContainEqual({
      path: '/api',
      key: 'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
      value: 'https://otlp.nr-data.net/v1/traces',
    });
    expect(settings).toContainEqual({
      path: '/api',
      key: 'OTEL_EXPORTER_OTLP_METRICS_ENDPOINT',
      value: 'https://otlp.nr-data.net/v1/metrics',
    });
    expect(
      settings.filter((setting) => /ENDPOINT$/.test(setting.key)).every((setting) => setting.value.length > 0),
    ).toBe(true);
    expect(
      settings.filter((setting) => setting.path !== '/api').every((setting) => !/secret/.test(setting.value)),
    ).toBe(true);
    expect(settings).toContainEqual({ path: '/superadmin', key: 'VITE_OTEL_ENABLED', value: 'true' });
  });
  it('disabling clears all destinations and credentials and disables browser capture', () => {
    const settings = telemetrySettings('tribe', { mode: 'off' });
    expect(
      settings.filter((setting) => /ENDPOINT|HEADERS/.test(setting.key)).every((setting) => setting.value === ''),
    ).toBe(true);
    expect(
      settings.filter((setting) => /ENABLED/.test(setting.key)).every((setting) => setting.value === 'false'),
    ).toBe(true);
  });
  it('rejects invalid URLs, headers, and sample ratios before writing secrets', () => {
    expect(() => telemetrySettings('tribe', { mode: 'otlp', endpoint: 'https://user:secret@host' })).toThrow();
    expect(() => telemetrySettings('tribe', { mode: 'otlp', endpoint: 'https://host', headers: 'invalid' })).toThrow();
    expect(() => telemetrySettings('tribe', { mode: 'otlp', endpoint: 'https://host', sampleRatio: '2' })).toThrow();
    expect(() => telemetrySettings('tribe', { mode: 'split', endpoint: 'https://host' })).toThrow();
  });
});
