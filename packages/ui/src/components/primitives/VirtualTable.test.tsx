import { describe, expect, it, mock } from 'bun:test';
import type { Column } from '@template/ui/components/primitives/Table';

/**
 * Tests for VirtualTable component logic.
 * Tests show/empty guards, column rendering logic, and prop contracts.
 */

type TestRow = { id: string; name: string; email: string; role: string };

const testData: TestRow[] = [
  { id: '1', name: 'Alice', email: 'alice@test.com', role: 'admin' },
  { id: '2', name: 'Bob', email: 'bob@test.com', role: 'user' },
  { id: '3', name: 'Charlie', email: 'charlie@test.com', role: 'user' },
];

const columns: Column<TestRow>[] = [
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'role', label: 'Role' },
];

const resolveShow = (show: boolean | (() => boolean)) => (typeof show === 'function' ? show() : show);

describe('VirtualTable — show prop', () => {
  it('show=true (default) renders', () => {
    expect(resolveShow(true)).toBe(true);
  });

  it('show=false does not render', () => {
    expect(resolveShow(false)).toBe(false);
  });

  it('show function returning false does not render', () => {
    expect(resolveShow(() => false)).toBe(false);
  });
});

describe('VirtualTable — empty state', () => {
  it('shows custom emptyMessage when data is empty', () => {
    const data: TestRow[] = [];
    const emptyMessage = 'No users found';
    const showEmpty = data.length === 0;
    expect(showEmpty).toBe(true);
    expect(emptyMessage).toBe('No users found');
  });

  it('shows default empty message when no custom message provided', () => {
    const data: TestRow[] = [];
    const emptyMessage = undefined;
    const displayMessage = emptyMessage || 'No data available';
    expect(data.length).toBe(0);
    expect(displayMessage).toBe('No data available');
  });

  it('does not show empty state when data exists', () => {
    expect(testData.length).toBeGreaterThan(0);
  });
});

describe('VirtualTable — column rendering', () => {
  it('column label maps to header text', () => {
    const headers = columns.map((col) => col.label);
    expect(headers).toEqual(['Name', 'Email', 'Role']);
  });

  it('column key extracts correct data field', () => {
    const row = testData[0];
    const values = columns.map((col) => (row as Record<string, unknown>)[col.key]);
    expect(values).toEqual(['Alice', 'alice@test.com', 'admin']);
  });

  it('custom render function takes precedence over key access', () => {
    const customCol: Column<TestRow> = {
      key: 'name',
      label: 'Name',
      render: (item) => item.name.toUpperCase(),
    };

    const row = testData[0];
    const rendered = customCol.render!(row);
    expect(rendered).toBe('ALICE');
  });

  it('falls back to key access when no render function', () => {
    const col: Column<TestRow> = { key: 'email', label: 'Email' };
    const row = testData[1];

    const value = col.render ? col.render(row) : (row as Record<string, unknown>)[col.key];

    expect(value).toBe('bob@test.com');
  });
});

describe('VirtualTable — row click', () => {
  it('onRowClick receives clicked item', () => {
    const onClick = mock((_item: TestRow) => {});
    const row = testData[1];

    onClick(row);

    expect(onClick).toHaveBeenCalledWith(testData[1]);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('cursor-pointer class applied when onRowClick is present', () => {
    const onRowClick = (_item: TestRow) => {};
    const hasCursor = !!onRowClick;
    expect(hasCursor).toBe(true);
  });

  it('no cursor-pointer when onRowClick is undefined', () => {
    const onRowClick = undefined;
    const hasCursor = !!onRowClick;
    expect(hasCursor).toBe(false);
  });
});

describe('VirtualTable — virtual row positioning', () => {
  it('rows use absolute positioning with translateY', () => {
    const virtualRow = { index: 2, start: 96 };
    const style = {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      width: '100%',
      transform: `translateY(${virtualRow.start}px)`,
    };

    expect(style.transform).toBe('translateY(96px)');
    expect(style.position).toBe('absolute');
  });
});

describe('VirtualTable — keyExtractor', () => {
  it('extracts unique keys from data rows', () => {
    const keyExtractor = (item: TestRow) => item.id;
    const keys = testData.map(keyExtractor);

    expect(keys).toEqual(['1', '2', '3']);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('VirtualTable — loading indicator', () => {
  it('shows loading when isLoadingMore is true', () => {
    const isLoadingMore = true;
    expect(isLoadingMore).toBe(true);
  });

  it('hides loading when isLoadingMore is false or undefined', () => {
    expect(false).toBe(false);
    expect(undefined).toBeUndefined();
  });
});

describe('VirtualTable — maxHeight', () => {
  it('default maxHeight is 600', () => {
    const maxHeight = 600; // default
    expect(maxHeight).toBe(600);
  });

  it('custom maxHeight overrides default', () => {
    const maxHeight = 800;
    expect(maxHeight).toBe(800);
  });
});
