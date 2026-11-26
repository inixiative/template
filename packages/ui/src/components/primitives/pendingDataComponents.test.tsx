/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { CardContent } from '@template/ui/components/primitives/Card';
import { List } from '@template/ui/components/primitives/List';
import { Skeleton } from '@template/ui/components/primitives/Skeleton';
import { Table } from '@template/ui/components/primitives/Table';
import { cleanup, render, screen } from '@testing-library/react';

afterEach(cleanup);

type Row = { id: string; name: string; role: string };
const columns = [
  { key: 'name', label: 'Name' },
  { key: 'role', label: 'Role' },
];

describe('Table', () => {
  test('a pending table keeps its header and draws placeholder rows, never the empty state', () => {
    const { container } = render(
      <Table<Row>
        columns={columns}
        data={[]}
        keyExtractor={(row) => row.id}
        isPending
        placeholderRows={4}
      />,
    );
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Role')).toBeTruthy();
    expect(screen.queryByText('Nothing here yet')).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(4);
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(2);
  });

  test('the same table shows its rows once loaded', () => {
    render(
      <Table<Row>
        columns={columns}
        data={[{ id: '1', name: 'Ada', role: 'owner' }]}
        keyExtractor={(row) => row.id}
        isPending={false}
      />,
    );
    expect(screen.getByText('Ada')).toBeTruthy();
  });
});

describe('List', () => {
  test('a pending list draws placeholder rows, not its empty message', () => {
    const { container } = render(
      <List<Row>
        items={[]}
        isPending
        emptyMessage="No rows"
        renderItem={(row) => <li key={row.id}>{row.name}</li>}
      />,
    );
    expect(screen.queryByText('No rows')).toBeNull();
    expect(container.querySelectorAll('li')).toHaveLength(3);
  });

  test('a loaded empty list shows its empty message', () => {
    render(
      <List<Row>
        items={[]}
        emptyMessage="No rows"
        renderItem={(row) => <li key={row.id}>{row.name}</li>}
      />,
    );
    expect(screen.getByText('No rows')).toBeTruthy();
  });
});

describe('CardContent', () => {
  test('pending content hides its children behind placeholder lines', () => {
    render(<CardContent isPending>Loaded body</CardContent>);
    expect(screen.queryByText('Loaded body')).toBeNull();
  });
});

describe('Skeleton', () => {
  test('wrapping content masks it while not loaded and shows it plainly once loaded', () => {
    const { container, rerender } = render(
      <Skeleton loaded={false}>
        <button type="button">Save</button>
      </Skeleton>,
    );
    const mask = container.firstElementChild as HTMLElement;
    expect(mask.getAttribute('aria-busy')).toBe('true');
    expect(mask.hasAttribute('inert')).toBe(true);
    rerender(
      <Skeleton loaded>
        <button type="button">Save</button>
      </Skeleton>,
    );
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
