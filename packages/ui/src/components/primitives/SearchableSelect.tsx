/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import * as Ariakit from '@ariakit/react';
import { useDebouncedCallback } from '@template/ui/hooks/useDebounce';
import type { SelectOption } from '@template/ui/lib/enumOptions';
import { cn } from '@template/ui/lib/utils';
import { startTransition, useRef, useState } from 'react';

export type SearchableSelectProps<TValue extends string = string> = {
  options: readonly SelectOption<TValue>[];
  value: TValue | '';
  onChange: (value: TValue | '') => void;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  loadingText?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-label'?: string;
};

const matchesQuery = (label: string, query: string) =>
  label.toLowerCase().includes(query.trim().toLowerCase());

export const SearchableSelect = <TValue extends string>({
  options,
  value,
  onChange,
  onSearch,
  isLoading = false,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results found.',
  loadingText = 'Searching…',
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: SearchableSelectProps<TValue>) => {
  const [query, setQuery] = useState('');
  const debouncedSearch = useDebouncedCallback((next: string) => onSearch?.(next));
  const knownLabels = useRef(new Map<string, string>());
  for (const option of options) knownLabels.current.set(option.value, option.label);

  const selectedLabel = value ? knownLabels.current.get(value) : undefined;
  const visibleOptions = onSearch
    ? options
    : options.filter((option) => matchesQuery(option.label, query));

  const updateQuery = (next: string) => {
    startTransition(() => setQuery(next));
    if (onSearch) debouncedSearch(next);
  };

  return (
    <Ariakit.ComboboxProvider resetValueOnHide setValue={updateQuery}>
      <Ariakit.SelectProvider value={value} setValue={(next) => onChange(next as TValue | '')}>
        <Ariakit.Select
          id={id}
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <span className={cn('truncate', !selectedLabel && 'text-muted-foreground')}>
            {selectedLabel ?? placeholder}
          </span>
          <Ariakit.SelectArrow className="text-muted-foreground" />
        </Ariakit.Select>
        <Ariakit.SelectPopover
          gutter={4}
          sameWidth
          className="z-50 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          <div className="border-b p-1">
            <Ariakit.Combobox
              autoSelect
              placeholder={searchPlaceholder}
              className="flex h-9 w-full rounded-sm bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <Ariakit.ComboboxList className="max-h-64 overflow-y-auto p-1">
            {isLoading ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">{loadingText}</div>
            ) : visibleOptions.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText}</div>
            ) : (
              visibleOptions.map((option) => (
                <Ariakit.SelectItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  render={<Ariakit.ComboboxItem />}
                  className={cn(
                    'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                    'data-[active-item]:bg-accent data-[active-item]:text-accent-foreground',
                    'aria-selected:font-medium',
                    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                  )}
                >
                  {option.label}
                </Ariakit.SelectItem>
              ))
            )}
          </Ariakit.ComboboxList>
        </Ariakit.SelectPopover>
      </Ariakit.SelectProvider>
    </Ariakit.ComboboxProvider>
  );
};
