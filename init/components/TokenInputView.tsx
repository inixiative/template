import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type React from 'react';
import { useCallback, useState } from 'react';
import { setSecretAsync } from '../tasks/infisicalSetup';
import { prompt } from '../utils/prompts';
import { ActionSpinner } from './ActionSpinner';
import { useAsyncAction } from './useAsyncAction';

export type TokenField = {
  /** Infisical secret key, e.g. 'PLANETSCALE_TOKEN' */
  key: string;
  /** Human-readable label shown next to input, e.g. "Token Value" */
  label: string;
  /** Mask input with * (for secret values) */
  mask?: boolean;
  /** Infisical destination */
  infisical: {
    environment: string;
    path?: string;
  };
};

type TokenInputViewProps = {
  /** Header shown at the top */
  title: string;
  /** Description lines shown above the inputs (instructions for the group) */
  description: string[];
  /** Token fields to collect, in order */
  tokens: TokenField[];
  /** Infisical project to save to */
  infisicalProjectId: string;
  /** Called with all collected values after saving to Infisical */
  onComplete: (values: Record<string, string>) => Promise<void>;
  /** Called when user presses Esc */
  onCancel: () => void;
};

/**
 * Reusable multi-token input screen.
 *
 * Shows group description/instructions, then walks through each token field
 * one at a time. Saves each to Infisical, then calls onComplete with all values.
 *
 * @example
 * ```tsx
 * <TokenInputView
 *   title="PlanetScale Service Token"
 *   description={[
 *     'Create a service token with database permissions:',
 *     '1. Go to: https://app.planetscale.com/settings/service-tokens',
 *     '2. Click "New service token"',
 *   ]}
 *   tokens={[
 *     { key: 'PLANETSCALE_TOKEN_ID', label: 'Token ID', infisical: { environment: 'root' } },
 *     { key: 'PLANETSCALE_TOKEN', label: 'Token Value', mask: true, infisical: { environment: 'root' } },
 *   ]}
 *   infisicalProjectId={projectId}
 *   onComplete={async (values) => { ... }}
 *   onCancel={onCancel}
 * />
 * ```
 */
export const TokenInputView: React.FC<TokenInputViewProps> = ({
  title,
  description,
  tokens,
  infisicalProjectId,
  onComplete,
  onCancel,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const t of tokens) {
      initial[t.key] = '';
    }
    return initial;
  });
  const [inputValue, setInputValue] = useState('');
  const saveAction = useAsyncAction();

  const currentToken = tokens[currentIndex];
  const isLastToken = currentIndex === tokens.length - 1;

  // Handle escape
  useInput((_input, key) => {
    if (key.escape && !saveAction.running) {
      onCancel();
    }
  });

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!value.trim()) return;

      const trimmed = value.trim();
      const updated = { ...values, [currentToken.key]: trimmed };
      setValues(updated);

      if (isLastToken) {
        // All fields collected — save to Infisical and call onComplete
        await saveAction.run('Saving to Infisical...', async () => {
          for (const token of tokens) {
            const val = token.key === currentToken.key ? trimmed : updated[token.key];
            await setSecretAsync(
              infisicalProjectId,
              token.infisical.environment,
              token.key,
              val,
              token.infisical.path ?? '/',
            );
          }
          await onComplete(updated);
        });
      } else {
        // Advance to next field
        setCurrentIndex((i) => i + 1);
        setInputValue('');
      }
    },
    [currentToken, isLastToken, values, tokens, infisicalProjectId, onComplete, saveAction],
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>{title}</Text>
      </Box>

      {/* Group description / instructions */}
      {description.length > 0 && (
        <Box flexDirection="column" marginBottom={1}>
          {description.map((line) => (
            <Text key={line} dimColor>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {/* Already-entered fields */}
      {tokens.slice(0, currentIndex).map((token) => (
        <Box key={token.key}>
          <Text dimColor>
            {token.label}: {token.mask ? '••••••••' : values[token.key]}
          </Text>
        </Box>
      ))}

      {/* Current input field */}
      {!saveAction.running && (
        <Box marginTop={currentIndex > 0 ? 0 : undefined}>
          <Text>{currentToken.label}: </Text>
          <TextInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            mask={currentToken.mask ? '*' : undefined}
          />
        </Box>
      )}

      {/* Saving spinner */}
      {saveAction.running && <ActionSpinner label={saveAction.actionLabel} />}

      {/* Error display */}
      {saveAction.error && (
        <Box marginTop={1}>
          <Text color="red">✗ {saveAction.error}</Text>
        </Box>
      )}

      {/* Prompt */}
      {!saveAction.running && (
        <Box marginTop={1}>
          <Text dimColor>
            {prompt(['enter', 'cancel'])}
            {tokens.length > 1 && ` (${currentIndex + 1}/${tokens.length})`}
          </Text>
        </Box>
      )}
    </Box>
  );
};
