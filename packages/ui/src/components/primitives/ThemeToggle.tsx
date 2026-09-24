/**
 * @atlas
 * @kind component
 * @partOf primitive:ui
 * @uses none
 */
import { Icon } from '@iconify/react';
import { cn } from '@template/ui/lib/utils';
import { useAppStore } from '@template/ui/store';
import type { Theme } from '@template/ui/store/types/ui';

export type ThemeToggleProps = Record<string, never>;

const options: { value: Theme; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'lucide:sun' },
  { value: 'dark', label: 'Dark', icon: 'lucide:moon' },
  { value: 'system', label: 'System', icon: 'lucide:monitor' },
];

export const ThemeToggle = () => {
  const theme = useAppStore((state) => state.ui.theme);
  const setTheme = useAppStore((state) => state.ui.setTheme);

  return (
    <div className="space-y-2">
      <span id="theme-toggle-label" className="text-sm font-medium">
        Theme
      </span>
      <div role="group" aria-labelledby="theme-toggle-label" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => setTheme(option.value)}
            className={cn(
              'flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors',
              theme === option.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon icon={option.icon} className="h-4 w-4" />
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};
