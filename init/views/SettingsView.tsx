import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  BACKEND_PROVIDERS,
  DATABASE_PROVIDERS,
  EMAIL_PROVIDERS,
  FRONTEND_PROVIDERS,
  type ProviderOption,
  REDIS_PROVIDERS,
} from '../providers';
import { useConfig } from '../utils/configState';
import {
  type BackendProvider,
  type DatabaseProvider,
  type EmailProvider,
  type FrontendProvider,
  getProjectConfig,
  type ProjectConfig,
  type RedisProvider,
  writeProjectConfig,
} from '../utils/getProjectConfig';

type SettingsViewProps = {
  onComplete: () => void;
  onCancel: () => void;
};

type Screen =
  | { kind: 'menu' }
  | { kind: 'staging' }
  | { kind: 'frontend' }
  | { kind: 'database' }
  | { kind: 'backend' }
  | { kind: 'redis' }
  | { kind: 'email' };

const formatLabel = <T extends string>(opt: ProviderOption<T>) => {
  const tag = opt.implemented ? '' : ' (coming soon)';
  return opt.note ? `${opt.label}${tag} — ${opt.note}` : `${opt.label}${tag}`;
};

const renderProviderRow = <T extends string>(label: string, options: ProviderOption<T>[], current: T) => {
  const opt = options.find((o) => o.value === current);
  const status = opt?.implemented ? '' : ' (coming soon)';
  return `${label.padEnd(16)} ${opt?.label ?? current}${status}`;
};

export const SettingsView: React.FC<SettingsViewProps> = ({ onComplete, onCancel }) => {
  const { config, syncConfig } = useConfig();
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [warning, setWarning] = useState<string | null>(null);

  useInput((_input, key) => {
    if (key.escape) {
      if (screen.kind === 'menu') onCancel();
      else setScreen({ kind: 'menu' });
    }
  });

  if (!config) {
    return (
      <Box padding={1}>
        <Text>Loading…</Text>
      </Box>
    );
  }

  const writeAndSync = async (mutator: (c: ProjectConfig) => void) => {
    const fresh = await getProjectConfig();
    mutator(fresh);
    await writeProjectConfig(fresh);
    await syncConfig();
  };

  const onPickProvider =
    <T extends string>(
      kind: keyof ProjectConfig['providers'],
      options: ProviderOption<T>[],
    ) =>
    async (item: { value: T }) => {
      const opt = options.find((o) => o.value === item.value);
      if (opt && !opt.implemented) {
        setWarning(`${opt.label} support is not implemented yet — keeping current selection.`);
        setScreen({ kind: 'menu' });
        return;
      }
      setWarning(null);
      await writeAndSync((c) => {
        (c.providers[kind] as T) = item.value;
      });
      setScreen({ kind: 'menu' });
    };

  if (screen.kind === 'menu') {
    const items = [
      {
        label: `Staging environment: ${config.features.staging.enabled ? 'enabled' : 'disabled'}`,
        value: 'staging',
      },
      { label: renderProviderRow('Frontend:', FRONTEND_PROVIDERS, config.providers.frontend), value: 'frontend' },
      { label: renderProviderRow('Database:', DATABASE_PROVIDERS, config.providers.database), value: 'database' },
      { label: renderProviderRow('Backend:', BACKEND_PROVIDERS, config.providers.backend), value: 'backend' },
      { label: renderProviderRow('Redis:', REDIS_PROVIDERS, config.providers.redis), value: 'redis' },
      { label: renderProviderRow('Email:', EMAIL_PROVIDERS, config.providers.email), value: 'email' },
      { label: 'Done — back to main menu', value: 'done' },
    ];
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold underline>
            Settings
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Toggle features and pick providers. Choices marked "coming soon" can't be selected yet.</Text>
        </Box>
        {warning && (
          <Box marginBottom={1}>
            <Text color="yellow">⚠ {warning}</Text>
          </Box>
        )}
        <SelectInput
          items={items}
          onSelect={(item) => {
            if (item.value === 'done') return onComplete();
            setScreen({ kind: item.value as Screen['kind'] });
          }}
        />
        <Box marginTop={1}>
          <Text dimColor>Esc to go back.</Text>
        </Box>
      </Box>
    );
  }

  if (screen.kind === 'staging') {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Staging environment</Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>
            On = Railway provisions a staging env + services + Redis volume; Infisical creates Staging folders.
          </Text>
        </Box>
        <Box marginBottom={1}>
          <Text dimColor>Off = single production environment only. Recommended for solo / nonprofit projects.</Text>
        </Box>
        <SelectInput
          items={[
            { label: 'Enabled', value: 'enabled' },
            { label: 'Disabled', value: 'disabled' },
          ]}
          onSelect={async (item) => {
            await writeAndSync((c) => {
              c.features.staging.enabled = item.value === 'enabled';
            });
            setScreen({ kind: 'menu' });
          }}
        />
      </Box>
    );
  }

  const providerScreen = useMemo(() => {
    if (screen.kind === 'frontend') return { title: 'Frontend host', options: FRONTEND_PROVIDERS, kind: 'frontend' as const };
    if (screen.kind === 'database') return { title: 'Database', options: DATABASE_PROVIDERS, kind: 'database' as const };
    if (screen.kind === 'backend') return { title: 'Backend host', options: BACKEND_PROVIDERS, kind: 'backend' as const };
    if (screen.kind === 'redis') return { title: 'Redis', options: REDIS_PROVIDERS, kind: 'redis' as const };
    if (screen.kind === 'email') return { title: 'Email provider', options: EMAIL_PROVIDERS, kind: 'email' as const };
    return null;
  }, [screen]);

  if (!providerScreen) return null;

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>{providerScreen.title}</Text>
      </Box>
      <SelectInput
        items={providerScreen.options.map((o) => ({ label: formatLabel(o), value: o.value }))}
        onSelect={onPickProvider(providerScreen.kind, providerScreen.options as ProviderOption<FrontendProvider | DatabaseProvider | BackendProvider | RedisProvider | EmailProvider>[])}
      />
      <Box marginTop={1}>
        <Text dimColor>Esc to go back without changing.</Text>
      </Box>
    </Box>
  );
};

export default SettingsView;
