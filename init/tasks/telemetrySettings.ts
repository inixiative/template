/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { parseOtlpHeaders, resolveOtlpEndpoint } from '../../packages/shared/src/telemetry/config';

export type TelemetrySetupInput = {
  mode: 'off' | 'otlp' | 'split';
  endpoint?: string;
  headers?: string;
  logsEndpoint?: string;
  logsHeaders?: string;
  browser?: boolean;
  sampleRatio?: string;
};
export const telemetrySettings = (
  projectName: string,
  input: TelemetrySetupInput,
): { path: string; key: string; value: string }[] => {
  const enabled = input.mode !== 'off';
  const endpoint = enabled ? input.endpoint?.trim() : '';
  if (enabled && !endpoint) throw new Error('An OTLP base endpoint is required');
  if (endpoint) resolveOtlpEndpoint(endpoint, 'traces');
  const headers = enabled ? (input.headers ?? '') : '';
  parseOtlpHeaders(headers);
  const logsEndpoint = input.mode === 'split' ? input.logsEndpoint?.trim() : '';
  if (input.mode === 'split' && !logsEndpoint) throw new Error('A logs endpoint including /v1/logs is required');
  if (logsEndpoint) resolveOtlpEndpoint(logsEndpoint, 'logs');
  const logsHeaders = input.mode === 'split' ? (input.logsHeaders ?? '') : headers;
  parseOtlpHeaders(logsHeaders);
  const ratio = input.sampleRatio ?? '1';
  if (!ratio.trim() || !Number.isFinite(Number(ratio)) || Number(ratio) < 0 || Number(ratio) > 1)
    throw new Error('Sample ratio must be between 0 and 1');
  const browser = enabled && input.browser === true;
  const api: Record<string, string> = {
    OTEL_ENABLED: String(enabled),
    OTEL_BROWSER_ENABLED: String(browser),
    OTEL_EXPORTER_OTLP_ENDPOINT: endpoint || '',
    OTEL_EXPORTER_OTLP_HEADERS: headers,
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: logsEndpoint || '',
    OTEL_EXPORTER_OTLP_LOGS_HEADERS: logsHeaders,
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: '',
    OTEL_EXPORTER_OTLP_TRACES_HEADERS: headers,
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: '',
    OTEL_EXPORTER_OTLP_METRICS_HEADERS: headers,
    OTEL_SERVICE_NAME: projectName,
    OTEL_TRACES_SAMPLER_ARG: ratio,
  };
  return [
    ...Object.entries(api).map(([key, value]) => ({ path: '/api', key, value })),
    ...['web', 'admin', 'superadmin'].flatMap((app) => [
      { path: `/${app}`, key: 'VITE_OTEL_ENABLED', value: String(browser) },
      { path: `/${app}`, key: 'VITE_OTEL_SAMPLE_RATIO', value: ratio },
    ]),
  ];
};
