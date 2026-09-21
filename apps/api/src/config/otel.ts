import { log } from '@template/shared/logger';
import { setLogService } from '@template/shared/logger/records';
import { readTelemetryConfig } from '@template/shared/telemetry/config';

let telemetry:
  | Awaited<ReturnType<typeof import('@template/shared/telemetry/initialize').initializeTelemetry>>
  | undefined;
export const initializeOpenTelemetry = async (role: 'api' | 'worker' = 'api') => {
  setLogService({ 'service.name': `${process.env.OTEL_SERVICE_NAME || 'template'}-${role}`, 'service.role': role });
  const config = readTelemetryConfig(role);
  if (!config) return;
  const { initializeTelemetry } = await import('@template/shared/telemetry/initialize');
  telemetry = initializeTelemetry(config);
  log.info({ service: config.serviceName }, 'OpenTelemetry enabled');
};
export const shutdownOpenTelemetry = async () => {
  await telemetry?.shutdown();
};
