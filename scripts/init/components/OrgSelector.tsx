import React from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { prompt } from '../utils/prompts';

export type Organization = {
	id: string;
	name: string;
	slug?: string;
};

type OrgSelectorProps = {
	organizations: Organization[];
	defaultOrgId?: string;
	serviceName: string;
	onSelect: (orgId: string) => void;
	onCancel: () => void;
};

export const OrgSelector: React.FC<OrgSelectorProps> = ({
	organizations,
	defaultOrgId,
	serviceName,
	onSelect,
	onCancel,
}) => {
	// Handle Esc to cancel
	useInput((input, key) => {
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
					<Text color="red">
						No organizations found. Please ensure you're logged in to {serviceName}.
					</Text>
				</Box>
				<Box marginTop={1}>
					<Text dimColor>Press Esc to cancel</Text>
				</Box>
			</Box>
		);
	}

	const items = organizations.map((org) => ({
		key: org.id,
		label: org.slug ? `${org.name} (${org.slug})` : org.name,
		value: org.id,
		isDefault: org.id === defaultOrgId,
	}));

	const itemComponent = ({ isSelected, label }: { isSelected: boolean; label: string }) => {
		const item = items.find((i) => i.label === label);
		const prefix = isSelected ? '❯ ' : '  ';
		const defaultBadge = item?.isDefault ? ' (default)' : '';

		return (
			<Text color={isSelected ? 'cyan' : undefined}>
				{prefix}{label}{defaultBadge}
			</Text>
		);
	};

	return (
		<Box flexDirection="column" padding={1}>
			<Box marginBottom={1}>
				<Text bold>Select {serviceName} Organization</Text>
			</Box>

			<Box marginBottom={1}>
				<Text dimColor>
					You have access to {organizations.length} organizations. Select one to continue:
				</Text>
			</Box>

			<SelectInput
				items={items}
				itemComponent={itemComponent}
				onSelect={(item) => {
					if (item?.value) {
						onSelect(item.value);
					}
				}}
			/>

			<Box marginTop={1}>
				<Text dimColor>{prompt(['navigate', 'select', 'cancel'])}</Text>
			</Box>
		</Box>
	);
};
