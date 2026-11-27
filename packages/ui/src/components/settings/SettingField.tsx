/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses primitive:shared
 */
import {
  AttributeValidationError,
  deduplicateMultiSelect,
  isStringArray,
  parseAttributeDate,
  validateAttributeValue,
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
import { useEffect, useId, useRef, useState } from 'react';

const SEARCHABLE_SELECT_THRESHOLD = 12;

export type SettingFieldProps = {
  item: AssembledSettingItem;
  value: unknown;
  onChange: (nextValue: unknown) => void;
  onValidityChange?: (isValid: boolean) => void;
  onReset?: () => void;
  resetVersion?: number;
  isResetting?: boolean;
  disabled?: boolean;
  disabledText?: string;
};

const formatDateTimeLocal = (value: unknown): string => {
  const parsed = parseAttributeDate(value);
  if (!parsed) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
};

const formatNumberText = (value: unknown): string =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const constraintError = (item: AssembledSettingItem, value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  try {
    validateAttributeValue(item.valueType, value, item);
    return null;
  } catch (error) {
    if (!(error instanceof AttributeValidationError)) throw error;
    return error.issues.map((issue) => issue.message).join('; ');
  }
};

export const SettingField = ({
  item,
  value,
  onChange,
  onValidityChange,
  onReset,
  resetVersion = 0,
  isResetting = false,
  disabled = false,
  disabledText,
}: SettingFieldProps) => {
  const inputId = useId();
  const [numberText, setNumberText] = useState(() =>
    item.valueType === 'number' ? formatNumberText(value) : '',
  );
  const [numberError, setNumberError] = useState<string | null>(null);
  const lastEmittedNumberRef = useRef<unknown>(value);
  const lastNumberResetVersionRef = useRef(resetVersion);

  const onValidityChangeRef = useRef(onValidityChange);
  onValidityChangeRef.current = onValidityChange;

  useEffect(() => {
    if (item.valueType !== 'number') return;
    const isReset = resetVersion !== lastNumberResetVersionRef.current;
    lastNumberResetVersionRef.current = resetVersion;
    if (!isReset && Object.is(value, lastEmittedNumberRef.current)) return;
    lastEmittedNumberRef.current = value;
    setNumberText(formatNumberText(value));
    setNumberError(null);
    onValidityChangeRef.current?.(true);
  }, [item.valueType, value, resetVersion]);

  const valueError = constraintError(item, value);
  useEffect(() => {
    onValidityChangeRef.current?.(!valueError);
  }, [valueError]);

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
        const options = (item.options ?? []).map(({ value, label }) => ({
          value: String(value),
          label,
        }));
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
          <div className="space-y-1">
            <Input
              id={inputId}
              type="number"
              value={numberText}
              disabled={disabled}
              onChange={(event) => {
                const raw = event.target.value;
                setNumberText(raw);
                if (raw.trim() === '') {
                  setNumberError('Enter a valid number');
                  onValidityChange?.(false);
                  return;
                }
                const parsed = Number(raw);
                if (Number.isFinite(parsed)) {
                  lastEmittedNumberRef.current = parsed;
                  setNumberError(null);
                  onValidityChange?.(true);
                  onChange(parsed);
                } else {
                  setNumberError('Enter a valid number');
                  onValidityChange?.(false);
                }
              }}
            />
            {numberError ? (
              <p role="alert" className="text-xs text-destructive">
                {numberError}
              </p>
            ) : null}
          </div>
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
        const options = (item.options ?? []).map(({ value, label }) => ({
          value: String(value),
          label,
        }));
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
            {options.map(({ value: option, label }) => {
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
                  {label}
                </label>
              );
            })}
          </fieldset>
        );
      }
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
      {valueError ? (
        <p role="alert" className="text-xs text-destructive">
          {valueError}
        </p>
      ) : null}
      {disabled && disabledText ? (
        <p className="text-xs text-muted-foreground">{disabledText}</p>
      ) : null}
    </div>
  );
};
