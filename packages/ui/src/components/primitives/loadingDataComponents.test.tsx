/**
 * @atlas
 * @kind test
 * @partOf primitive:ui
 * @uses none
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { CardContent } from '@template/ui/components/primitives/Card';
import { List } from '@template/ui/components/primitives/List';
import { LoadingMask } from '@template/ui/components/primitives/LoadingMask';
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
    expect(container.querySelector('tbody[data-loading-mask][inert]')).toBeTruthy();
  });

  test("a column's placeholder is drawn while loading and kept invisibly under each loaded cell", () => {
    const badgeColumns = [
      { key: 'name', label: 'Name' },
      { key: 'role', label: 'Role', placeholder: <span data-testid="role-shape">role</span> },
    ];
    const { container, rerender } = render(
      <Table<Row> columns={badgeColumns} data={[]} keyExtractor={(row) => row.id} isLoading />,
    );
    expect(screen.getAllByTestId('role-shape')).toHaveLength(5);
    rerender(
      <Table<Row>
        columns={badgeColumns}
        data={[{ id: '1', name: 'Ada', role: 'owner' }]}
        keyExtractor={(row) => row.id}
        isLoading={false}
      />,
    );
    const shape = screen.getByTestId('role-shape').parentElement as HTMLElement;
    expect(shape.className).toContain('invisible');
    expect(shape.hasAttribute('inert')).toBe(true);
    expect(screen.getByText('owner')).toBeTruthy();
    expect(container.querySelector('tbody[data-loading-mask]')).toBeNull();
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

  test('a loading list draws its placeholder item three times', () => {
    render(
      <List<Row>
        items={[]}
        isLoading
        placeholderItem={<li data-testid="row-shape">row</li>}
        renderItem={(row) => <li key={row.id}>{row.name}</li>}
      />,
    );
    expect(screen.getAllByTestId('row-shape')).toHaveLength(3);
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
    expect(container.querySelector('[data-loading-mask][inert] button')).toBeTruthy();
  });

  test('loading content with no renderable children draws masked placeholder lines', () => {
    const { container } = render(<CardContent isLoading>{false}</CardContent>);
    const content = container.firstElementChild as HTMLElement;
    expect(content.hasAttribute('data-loading-mask')).toBe(true);
    expect(content.querySelectorAll('p').length).toBeGreaterThan(0);
  });
});

describe('LoadingMask', () => {
  test('masks its content while loading and keeps the same element once loaded', () => {
    const { container, rerender } = render(
      <LoadingMask isLoading className="mask">
        <button type="button">Save</button>
      </LoadingMask>,
    );
    const mask = container.firstElementChild as HTMLElement;
    expect(mask.getAttribute('aria-busy')).toBe('true');
    expect(mask.hasAttribute('inert')).toBe(true);
    expect(mask.hasAttribute('data-loading-mask')).toBe(true);
    rerender(
      <LoadingMask isLoading={false} className="mask">
        <button type="button">Save</button>
      </LoadingMask>,
    );
    expect(container.firstElementChild).toBe(mask);
    expect(mask.className).toBe('mask');
    expect(mask.hasAttribute('inert')).toBe(false);
    expect(mask.hasAttribute('data-loading-mask')).toBe(false);
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});
