/**
 * @atlas
 * @kind service
 * @partOf infrastructure:observability
 * @uses none
 */
import { getProjectConfig, writeProjectConfig } from '../utils/getProjectConfig';
import { setSecretAsync } from './infisicalSetup';
import { type TelemetrySetupInput, telemetrySettings } from './telemetrySettings';

export const setupTelemetry = async (input: TelemetrySetupInput, onProgress?: (key: string) => void): Promise<void> => {
  const config = await getProjectConfig();
  if (!config.infisical.projectId) throw new Error('Run Infisical setup first');
  const settings = telemetrySettings(config.project.name, input);
  config.monitoring = { mode: input.mode, configProjectName: config.project.name, progress: {} };
  await writeProjectConfig(config);
  for (const setting of settings) {
    const id = `${setting.path}/${setting.key}`;
    onProgress?.(id);
    try {
      await setSecretAsync(config.infisical.projectId, 'root', setting.key, setting.value, setting.path);
    } catch {
      throw new Error(`Could not store ${id}; rerun Monitoring setup to retry`);
    }
    const current = await getProjectConfig();
    current.monitoring = { ...config.monitoring, progress: { ...current.monitoring?.progress, [id]: true } };
    await writeProjectConfig(current);
  }
};
