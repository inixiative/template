/**
 * @atlas
 * @kind component
 * @partOf infrastructure:observability
 * @uses none
 */
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { useState } from 'react';
import type { TelemetrySetupInput } from '../tasks/telemetrySettings';
import { setupTelemetry } from '../tasks/telemetrySetup';
import { useConfig } from '../utils/configState';
import { prompt } from '../utils/prompts';

export const TelemetrySetupView = ({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) => {
  const { syncConfig } = useConfig();
  const [input, setInput] = useState<TelemetrySetupInput>({ mode: 'off' });
  const [step, setStep] = useState('mode');
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  useInput((_input, key) => {
    if (key.escape && !running) onCancel();
  });
  const run = async (settings: TelemetrySetupInput) => {
    setRunning(true);
    setError('');
    try {
      await setupTelemetry(settings, setStatus);
      await syncConfig();
      setStep('done');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Monitoring setup failed');
      setStep('mode');
    } finally {
      setRunning(false);
    }
  };
  const submit = (text: string) => {
    const next = { ...input, [step]: text };
    setInput(next);
    setValue('');
    if (step === 'endpoint') setStep('headers');
    else if (step === 'headers' && input.mode === 'split') setStep('logsEndpoint');
    else if (step === 'logsEndpoint') setStep('logsHeaders');
    else if (step === 'sampleRatio') {
      void run(next);
    } else setStep('browser');
  };
  const labels: Record<string, string> = {
    endpoint: 'OTLP base URL (New Relic US: https://otlp.nr-data.net):',
    headers: 'OTLP headers (New Relic: api-key=YOUR_LICENSE_KEY; blank for local):',
    logsEndpoint: 'Better Stack source URL including /v1/logs:',
    logsHeaders: 'Logs headers (Authorization=Bearer YOUR_SOURCE_TOKEN):',
    sampleRatio: 'Trace sample ratio, 0–1 (1 captures all):',
  };
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Monitoring — structured logs, traces, and metrics</Text>
      <Text>
        Stores settings in Infisical. Apply them through your normal deployment; browser settings require a rebuild.
      </Text>
      {error && <Text color="red">{error}</Text>}
      {running ? (
        <Text>Storing {status}</Text>
      ) : step === 'mode' ? (
        <SelectInput
          items={[
            { label: 'One OTLP destination (any provider)', value: 'otlp' },
            { label: 'New Relic traces/metrics + Better Stack logs', value: 'split' },
            { label: 'Disable exports (keep local/console logging)', value: 'off' },
          ]}
          onSelect={({ value: mode }) => {
            const settings = { mode: mode as TelemetrySetupInput['mode'] };
            setInput(settings);
            if (mode === 'off') void run(settings);
            else {
              setStep('endpoint');
              setValue(mode === 'split' ? 'https://otlp.nr-data.net' : '');
            }
          }}
        />
      ) : step === 'browser' ? (
        <SelectInput
          items={[
            { label: 'Enable browser errors and request traces', value: true },
            { label: 'Server telemetry only', value: false },
          ]}
          onSelect={({ value: browser }) => {
            setInput({ ...input, browser });
            setStep('sampleRatio');
            setValue('1');
          }}
        />
      ) : step === 'done' ? (
        <SelectInput items={[{ label: 'Settings stored — return to menu', value: 'done' }]} onSelect={onComplete} />
      ) : (
        <Box flexDirection="column">
          <Text>{labels[step]}</Text>
          <TextInput
            value={value}
            onChange={setValue}
            onSubmit={submit}
            mask={step.toLowerCase().includes('headers') ? '*' : undefined}
          />
        </Box>
      )}
      {!running && <Text dimColor>{prompt(['enter', 'cancel'])}</Text>}
    </Box>
  );
};
