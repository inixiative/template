/**
 * @atlas
 * @kind config
 * @partOf infrastructure:observability
 * @uses none
 */
import { z } from 'zod';

const samplingEnvironment = z.object({ OTEL_TRACES_SAMPLER_ARG: z.coerce.number().min(0).max(1).default(1) });

export const parseOtlpHeaders = (value = ''): Record<string, string> =>
  Object.fromEntries(
    value
      .split(',')
      .filter(Boolean)
      .map((entry) => {
        const separator = entry.indexOf('=');
        if (separator < 1) throw new Error('OTLP headers must use key=value pairs');
        const key = entry.slice(0, separator).trim();
        const decoded = decodeURIComponent(entry.slice(separator + 1).trim());
        if (!/^[a-zA-Z0-9-]+$/.test(key) || /[\r\n]/.test(decoded)) throw new Error('Invalid OTLP header');
        return [key, decoded];
      }),
  );

export const resolveOtlpEndpoint = (endpoint: string, signal: 'traces' | 'metrics' | 'logs'): string => {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('OTLP endpoint must be an HTTP(S) base URL without credentials, query, or fragment');
  url.pathname = `${url.pathname.replace(/\/$/, '')}/v1/${signal}`;
  return url.toString();
};

export const signalExportOptions = (
  signal: 'traces' | 'metrics' | 'logs',
  endpoint: string,
  headers: Record<string, string>,
) => {
  const specificEndpoint = process.env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`];
  const specificHeaders = process.env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_HEADERS`];
  if (specificEndpoint) {
    resolveOtlpEndpoint(specificEndpoint, signal);
    if (new URL(specificEndpoint).origin !== new URL(endpoint).origin && specificHeaders === undefined)
      throw new Error(`Separate ${signal} endpoint requires explicit signal headers to avoid leaking credentials`);
  }
  return {
    url: specificEndpoint || resolveOtlpEndpoint(endpoint, signal),
    headers:
      specificHeaders === undefined || (!specificEndpoint && specificHeaders === '')
        ? headers
        : parseOtlpHeaders(specificHeaders),
  };
};

export const readTelemetryConfig = (role: 'api' | 'worker') => {
  const environment = process.env.ENVIRONMENT || 'local';
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const enabled = process.env.OTEL_ENABLED
    ? process.env.OTEL_ENABLED === 'true'
    : ['pr', 'staging', 'prod'].includes(environment) && Boolean(endpoint);
  if (!enabled) return null;
  if (!endpoint) throw new Error('OTEL_ENABLED=true requires OTEL_EXPORTER_OTLP_ENDPOINT');
  const { OTEL_TRACES_SAMPLER_ARG: sampleRatio } = samplingEnvironment.parse(process.env);
  resolveOtlpEndpoint(endpoint, 'traces');
  return {
    endpoint,
    headers: parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS),
    sampleRatio,
    serviceName: `${process.env.OTEL_SERVICE_NAME || 'template'}-${role}`,
    environment,
    serviceVersion: process.env.OTEL_SERVICE_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || 'development',
    role,
  };
};
export type TelemetryConfig = NonNullable<ReturnType<typeof readTelemetryConfig>>;
