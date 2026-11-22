/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import {
  deduplicateMultiSelect,
  isStringArray,
  parseAttributeDate,
} from '@template/shared/attributes';
import type { AssembledSettingItem } from '@template/shared/settings';
import {
  Badge,
  Button,
  Input,
  Label,
  SearchableSelect,
  Select,
} from '@template/ui/components/primitives';
import { cn } from '@template/ui/lib/utils';
import { useEffect, useId, useState } from 'react';

const SEARCHABLE_SELECT_THRESHOLD = 12;

export type SettingFieldProps = {
  item: AssembledSettingItem;
  value: unknown;
  onChange: (nextValue: unknown) => void;
  onReset?: () => void;
  isResetting?: boolean;
  disabled?: boolean;
  disabledText?: string;
};

const extractStringEnum = (schema: Record<string, unknown>): string[] => {
  if (Array.isArray(schema.enum) && schema.enum.every((entry) => typeof entry === 'string')) {
    return schema.enum;
  }
  return [];
};

const extractMultiSelectOptions = (schema: Record<string, unknown>): string[] => {
  const items = schema.items;
  if (items && typeof items === 'object' && !Array.isArray(items)) {
    return extractStringEnum(items as Record<string, unknown>);
  }
  return [];
};

const formatDateTimeLocal = (value: unknown): string => {
  const parsed = parseAttributeDate(value);
  if (!parsed) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

export const SettingField = ({
  item,
  value,
  onChange,
  onReset,
  isResetting = false,
  disabled = false,
  disabledText,
}: SettingFieldProps) => {
  const inputId = useId();
  const [jsonText, setJsonText] = useState(() =>
    item.valueType === 'json' && value !== null && value !== undefined
      ? JSON.stringify(value, null, 2)
      : '',
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (item.valueType !== 'json') return;
    setJsonText(value !== null && value !== undefined ? JSON.stringify(value, null, 2) : '');
    setJsonError(null);
  }, [item.valueType, value]);

  const renderControl = () => {
    switch (item.valueType) {
      case 'boolean':
        return (
          <div className="flex items-center gap-2 pt-1">
            <input
              id={inputId}
              type="checkbox"
              checked={Boolean(value)}
              disabled={disabled}
              onChange={(event) => onChange(event.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
            <span className="text-sm text-muted-foreground">{value ? 'Enabled' : 'Disabled'}</span>
          </div>
        );

      case 'text': {
        const enumValues = extractStringEnum(item.schema);
        const options = enumValues.map((option) => ({ value: option, label: option }));
        const currentValue = typeof value === 'string' ? value : '';

        if (options.length > SEARCHABLE_SELECT_THRESHOLD) {
          return (
            <SearchableSelect
              id={inputId}
              aria-label={item.label}
              options={options}
              value={currentValue}
              disabled={disabled}
              onChange={(next) => {
                if (next) onChange(next);
              }}
            />
          );
        }
        if (options.length > 0) {
          return (
            <Select
              id={inputId}
              aria-label={item.label}
              options={options}
              value={currentValue}
              disabled={disabled}
              onChange={(next) => onChange(next)}
            />
          );
        }
        return (
          <Input
            id={inputId}
            type="text"
            value={currentValue}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        );
      }

      case 'number':
        return (
          <Input
            id={inputId}
            type="number"
            value={typeof value === 'number' && Number.isFinite(value) ? String(value) : ''}
            disabled={disabled}
            onChange={(event) => {
              const raw = event.target.value;
              if (raw === '') return;
              const parsed = Number(raw);
              if (Number.isFinite(parsed)) onChange(parsed);
            }}
          />
        );

      case 'date':
        return (
          <Input
            id={inputId}
            type="datetime-local"
            value={formatDateTimeLocal(value)}
            disabled={disabled}
            onChange={(event) => {
              const raw = event.target.value;
              if (!raw) return;
              const parsed = parseAttributeDate(raw);
              if (parsed) onChange(parsed.toISOString());
            }}
          />
        );

      case 'multiSelect': {
        const options = extractMultiSelectOptions(item.schema);
        const selected = isStringArray(value) ? deduplicateMultiSelect(value) : [];
        const selectedSet = new Set(selected);

        const toggle = (option: string) => {
          const next = selectedSet.has(option)
            ? selected.filter((entry) => entry !== option)
            : [...selected, option];
          onChange(deduplicateMultiSelect(next));
        };

        return (
          <fieldset className="flex flex-wrap gap-2 border-0 p-0 pt-1" aria-label={item.label}>
            {options.map((option) => {
              const isSelected = selectedSet.has(option);
              return (
                <label
                  key={option}
                  className={cn(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input bg-background text-muted-foreground',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabled}
                    onChange={() => toggle(option)}
                    className="sr-only"
                  />
                  {option}
                </label>
              );
            })}
          </fieldset>
        );
      }

      case 'json':
        return (
          <div className="space-y-1">
            <textarea
              id={inputId}
              aria-label={item.label}
              rows={4}
              value={jsonText}
              disabled={disabled}
              onChange={(event) => {
                const nextText = event.target.value;
                setJsonText(nextText);
                try {
                  const parsed: unknown = JSON.parse(nextText);
                  setJsonError(null);
                  onChange(parsed);
                } catch {
                  setJsonError('Invalid JSON syntax');
                }
              }}
              className={cn(
                'flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background',
                'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                'disabled:cursor-not-allowed disabled:opacity-50',
              )}
            />
            {jsonError ? (
              <p role="alert" className="text-xs text-destructive">
                {jsonError}
              </p>
            ) : null}
          </div>
        );
    }
  };

  return (
    <div className="space-y-2" data-testid={`setting-field-${item.key}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Label htmlFor={inputId}>{item.label}</Label>
            {item.isDefault ? (
              <Badge variant="outline" className="text-[10px]">
                Default
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{item.description}</p>
        </div>
        {item.settingId !== null && !disabled && onReset ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isResetting}
            aria-label={`Reset ${item.label} to default`}
            onClick={onReset}
          >
            Reset
          </Button>
        ) : null}
      </div>
      {renderControl()}
      {disabled && disabledText ? (
        <p className="text-xs text-muted-foreground">{disabledText}</p>
      ) : null}
    </div>
  );
};
