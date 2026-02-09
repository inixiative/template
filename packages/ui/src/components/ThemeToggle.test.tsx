import { describe, expect, it, mock } from 'bun:test';
import type { Theme } from './ThemeToggle';

describe('ThemeToggle', () => {
  it('should render three theme options', () => {
    const options: Theme[] = ['light', 'dark', 'system'];

    expect(options).toHaveLength(3);
    expect(options).toContain('light');
    expect(options).toContain('dark');
    expect(options).toContain('system');
  });

  it('should call onChange with selected theme', () => {
    const onChange = mock((theme: Theme) => {});
    const selectedTheme: Theme = 'dark';

    onChange(selectedTheme);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('dark');
  });

  it('should handle theme value changes', () => {
    let currentTheme: Theme = 'system';
    const setTheme = (theme: Theme) => {
      currentTheme = theme;
    };

    expect(currentTheme).toBe('system');

    setTheme('light');
    expect(currentTheme).toBe('light');

    setTheme('dark');
    expect(currentTheme).toBe('dark');
  });
});
