import { describe, expect, it } from 'bun:test';
import { pickColumns } from '@template/db/utils/pickColumns';

describe('pickColumns', () => {
  it('keeps scalar and enum columns, dropping included relations', () => {
    const data = {
      id: '1',
      status: 'sent',
      sourceOrganizationId: 'org-1',
      sourceOrganization: { id: 'org-1' },
      auditLogsAsSubject: [{ id: 'a1', actorToken: { id: 't1', keyHash: 'h' } }],
    };
    expect(pickColumns('Inquiry', data)).toEqual({
      id: '1',
      status: 'sent',
      sourceOrganizationId: 'org-1',
    });
  });
});
