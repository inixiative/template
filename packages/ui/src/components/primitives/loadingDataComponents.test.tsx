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
  test('a loading table keeps its header and draws placeholder rows, never the empty state', () => {
    const { container } = render(
      <Table<Row> columns={columns} data={[]} keyExtractor={(row) => row.id} isLoading />,
    );
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Role')).toBeTruthy();
    expect(screen.queryByText('Nothing here yet')).toBeNull();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(container.querySelectorAll('tbody tr:first-child td')).toHaveLength(2);
  });

  test('the same table shows its rows once loaded', () => {
    render(
      <Table<Row>
        columns={columns}
        data={[{ id: '1', name: 'Ada', role: 'owner' }]}
        keyExtractor={(row) => row.id}
        isLoading={false}
      />,
    );
    expect(screen.getByText('Ada')).toBeTruthy();
  });
});

describe('List', () => {
  test('a loading list draws placeholder rows, not its empty message', () => {
    const { container } = render(
      <List<Row>
        items={[]}
        isLoading
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
  test('loading content masks children that can render, keeping their shape', () => {
    const { container } = render(
      <CardContent isLoading>
        <button type="button">Save</button>
      </CardContent>,
    );
    expect(container.querySelector('[inert] button')).toBeTruthy();
  });

  test('loading content with no renderable children draws placeholder lines', () => {
    const { container } = render(<CardContent isLoading>{false}</CardContent>);
    expect(container.querySelector('[inert]')).toBeNull();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});

describe('Skeleton', () => {
  test('wrapping content masks it while not loaded and shows it plainly once loaded', () => {
    const { container, rerender } = render(
      <Skeleton isLoading>
        <button type="button">Save</button>
      </Skeleton>,
    );
    const mask = container.firstElementChild as HTMLElement;
    expect(mask.getAttribute('aria-busy')).toBe('true');
    expect(mask.hasAttribute('inert')).toBe(true);
    rerender(
      <Skeleton isLoading={false}>
        <button type="button">Save</button>
      </Skeleton>,
    );
    expect(container.querySelector('[aria-busy]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
