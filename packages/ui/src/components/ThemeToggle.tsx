import { useAppStore, type Theme } from '@template/shared';
import { Label } from './Label';
import { Button } from './Button';

export type ThemeToggleProps = Record<string, never>;

export const ThemeToggle = () => {
  // Read from Zustand store
  const theme = useAppStore((state) => state.ui.theme);
  const setTheme = useAppStore((state) => state.ui.setTheme);
  const options: { value: Theme; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'dark', label: 'Dark', icon: '🌙' },
    { value: 'system', label: 'System', icon: '💻' },
  ];

  return (
    <div className="space-y-2">
      <Label>Theme</Label>
      <div className="flex gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            variant={theme === option.value ? 'default' : 'outline'}
            onClick={() => setTheme(option.value)}
            className="flex-1"
          >
            <span className="mr-2">{option.icon}</span>
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
};
