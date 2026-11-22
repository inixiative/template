import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildModelCapabilitiesRows,
  CAPABILITIES_END,
  CAPABILITIES_START,
  renderModelCapabilitiesTable,
  replaceCapabilitiesBlock,
} from '#/hooks/modelCapabilitiesDoc';

describe('generateModelCapabilities', () => {
  it('builds sorted rows covering core models and their real registries', () => {
    const rows = buildModelCapabilitiesRows();
    const byModel = new Map(rows.map((row) => [row.model, row]));

    expect(rows.length).toBeGreaterThan(20);
    expect(rows.map((row) => row.model)).toEqual([...rows.map((row) => row.model)].sort());

    const organization = byModel.get('Organization');
    expect(organization).toEqual(
      expect.objectContaining({
        model: 'Organization',
        audit: true,
        cached: true,
        rebac: true,
      }),
    );
    expect(organization?.deleteLifecycle).toContain('soft');

    const authProvider = byModel.get('AuthProvider');
    expect(authProvider?.encrypted).toBe(true);
    expect(authProvider?.fieldPolicies).toContain('sensitive');

    const entitlement = byModel.get('Entitlement');
    expect(entitlement?.parentEdge).toBe('axis: targetModel');
    expect(entitlement?.polymorphicAxes).toEqual(['sourceModel', 'targetModel']);

    const contact = byModel.get('Contact');
    expect(contact?.orderedList).toBe(true);
  });

  it('replaces content strictly between capability markers', () => {
    const sample = `Before\n${CAPABILITIES_START}\nold\n${CAPABILITIES_END}\nAfter`;
    const updated = replaceCapabilitiesBlock(sample, '| Model |\n|---|\n| User |');
    expect(updated).toBe(
      `Before\n${CAPABILITIES_START}\n\n| Model |\n|---|\n| User |\n\n${CAPABILITIES_END}\nAfter`,
    );
  });

  it('throws when capability markers are missing', () => {
    expect(() => replaceCapabilitiesBlock('no markers here', 'table')).toThrow(
      /Missing .* markers/,
    );
  });

  it('keeps docs/claude/MODEL_CAPABILITIES.md in sync with the live registries', () => {
    const repoRoot = resolve(import.meta.dir, '../../../..');
    const docPath = resolve(repoRoot, 'docs/claude/MODEL_CAPABILITIES.md');
    const committed = readFileSync(docPath, 'utf8');
    const expected = replaceCapabilitiesBlock(
      committed,
      renderModelCapabilitiesTable(buildModelCapabilitiesRows()),
    );
    expect(committed).toBe(expected);
  });
});
