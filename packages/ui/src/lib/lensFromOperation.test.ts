import { describe, expect, it } from 'bun:test';
import { lensFromOperation } from '@template/ui/lib/lensFromOperation';

describe('lensFromOperation', () => {
  it('resolves a readMany operation to its response component lens', () => {
    const lens = lensFromOperation('meReceivedManyInquiries');
    expect(lens.model).toBe('InquiryReceivedItem');
    const fields = lens.maps.sdk.models.InquiryReceivedItem.fields;
    expect(fields.createdAt).toEqual({ kind: 'scalar', type: 'DateTime' });
    expect(fields.status.kind).toBe('enum');
  });

  it('two endpoints sharing a response component share the lens vocabulary', () => {
    const received = lensFromOperation('meReceivedManyInquiries');
    const alsoReceived = lensFromOperation('organizationReceivedManyInquiries');
    expect(alsoReceived.model).toBe(received.model);
    const sent = lensFromOperation('meSentManyInquiries');
    expect(sent.model).toBe('InquirySentItem');
    expect(sent.model).not.toBe(received.model);
  });

  it('unwraps a single-resource read (non-array data envelope)', () => {
    const lens = lensFromOperation('inquiryRead');
    expect(lens.model).toBe('InquiryItem');
    expect(lens.maps.sdk.models.InquiryItem.fields.sourceUser.kind).toBe('object');
  });

  it('renders Json columns as scalar Json and inline relations as child models', () => {
    const lens = lensFromOperation('adminInquiryReadMany');
    const fields = lens.maps.sdk.models.InquiryItem.fields;
    expect(fields.content).toEqual({ kind: 'scalar', type: 'Json' });
    expect(fields.sourceUser.kind).toBe('object');
    expect(lens.maps.sdk.models['InquiryItem.sourceUser'].fields.id).toEqual({
      kind: 'scalar',
      type: 'String',
    });
  });

  it('throws on an unknown operationId', () => {
    expect(() => lensFromOperation('nopeReadMany')).toThrow('unknown operationId');
  });
});
