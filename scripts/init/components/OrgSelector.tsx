import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import React from 'react';
import { prompt } from '../utils/prompts';

export type Organization = {
  id?: string;
  name: string;
  slug?: string;
};

type OrgSelectorProps = {
  organizations: Organization[];
  serviceName: string;
  identifierKey?: 'id' | 'name';
  loading?: boolean;
  onSelect: (orgId: string) => void;
  onCancel: () => void;
};

export const OrgSelector: React.FC<OrgSelectorProps> = ({
  organizations,
  serviceName,
  identifierKey = 'id',
  loading = false,
  onSelect,
  onCancel,
}) => {
  // Handle Esc to cancel
  useInput((_input, key) => {
    if (key.escape) {
      onCancel();
    }
  });

  // Auto-select if only one org
  React.useEffect(() => {
    if (organizations.length === 1) {
      onSelect(organizations[0].id);
    }
  }, [organizations, onSelect]);

  // Don't render if only one org (auto-selected above)
  if (organizations.length === 1) {
    return null;
  }

  // Handle empty organizations list
  if (organizations.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box marginBottom={1}>
          <Text bold>Select {serviceName} Organization</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="red">No organizations found. Please ensure you're logged in to {serviceName}.</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press Esc to cancel</Text>
        </Box>
      </Box>
    );
  }

  const items = organizations.map((org) => {
    const identifier = org[identifierKey];
    return {
      key: identifier,
      label: org.slug ? `${org.name} (${org.slug})` : org.name,
      value: identifier,
    };
  });

  const itemComponent = ({ isSelected, label }: { isSelected: boolean; label: string }) => {
    const prefix = isSelected ? '❯ ' : '  ';

    return (
      <Text color={isSelected ? 'cyan' : undefined}>
        {prefix}
        {label}
      </Text>
    );
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Select {serviceName} Organization</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>You have access to {organizations.length} organizations. Select one to continue:</Text>
      </Box>

      <SelectInput
        items={items}
        itemComponent={itemComponent}
        indicatorComponent={() => null}
        onSelect={(item) => {
          if (item?.value) {
            onSelect(item.value);
          }
        }}
      />

      {loading && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" /> Processing...
          </Text>
        </Box>
      )}

      {!loading && (
        <Box marginTop={1}>
          <Text dimColor>{prompt(['navigate', 'select', 'cancel'])}</Text>
        </Box>
      )}
    </Box>
  );
};
