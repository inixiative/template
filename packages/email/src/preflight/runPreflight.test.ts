import { describe, expect, it } from 'bun:test';
import { runPreflight } from '@template/email/preflight/runPreflight';

describe('runPreflight', () => {
  it('orders errors before warnings and counts both', async () => {
    const result = await runPreflight({
      mjml: '<mjml><mj-body></mj-body></mjml>',
      subject: '',
      html: '<p>Hi</p><img src="https://cdn.example/x.png">',
      fieldPaths: [],
      renderWarnings: [],
    });
    expect(result.findings.map((finding) => finding.code)).toEqual([
      'subject.missing',
      'preheader.missing',
      'unsubscribe.missing',
      'image.alt.missing',
    ]);
    expect(result.summary).toEqual({ errors: 1, warnings: 3 });
  });

  it('runs only the checks it is given, including async ones', async () => {
    const result = await runPreflight({ mjml: '', subject: 'x', html: '', fieldPaths: [], renderWarnings: [] }, [
      async () => [{ code: 'net.slow', severity: 'warning', message: 'slow' }],
    ]);
    expect(result).toEqual({
      findings: [{ code: 'net.slow', severity: 'warning', message: 'slow' }],
      summary: { errors: 0, warnings: 1 },
    });
  });

  it('keeps fulfilled findings when a synchronous check throws', async () => {
    const result = await runPreflight({ mjml: '', subject: 'x', html: '', fieldPaths: [], renderWarnings: [] }, [
      () => [{ code: 'net.slow', severity: 'warning', message: 'slow' }],
      () => {
        throw new Error('parser exploded');
      },
    ]);

    expect(result.findings).toEqual([
      { code: 'preflight.failed', severity: 'error', message: 'Preflight check failed: parser exploded' },
      { code: 'net.slow', severity: 'warning', message: 'slow' },
    ]);
    expect(result.summary).toEqual({ errors: 1, warnings: 1 });
  });

  it('keeps fulfilled findings and reports a failed check when another check rejects', async () => {
    const result = await runPreflight({ mjml: '', subject: 'x', html: '', fieldPaths: [], renderWarnings: [] }, [
      async () => [{ code: 'net.slow', severity: 'warning', message: 'slow' }],
      async () => {
        throw new Error('provider unavailable');
      },
    ]);

    expect(result).toEqual({
      findings: [
        { code: 'preflight.failed', severity: 'error', message: 'Preflight check failed: provider unavailable' },
        { code: 'net.slow', severity: 'warning', message: 'slow' },
      ],
      summary: { errors: 1, warnings: 1 },
    });
  });

  it('turns render warnings into error findings and includes them in the summary', async () => {
    const result = await runPreflight({
      mjml: '<mjml><mj-head><mj-preview>Peek</mj-preview></mj-head><mj-body></mj-body></mjml>',
      subject: 'Your weekly digest',
      html: '<p>Hello</p><a href="https://example.com/unsubscribe">Unsubscribe</a>',
      fieldPaths: [],
      renderWarnings: ['{{recipient}} resolved to a non-primitive value and was left unsubstituted'],
    });

    expect(result.findings).toEqual([
      {
        code: 'render.warning',
        severity: 'error',
        message: '{{recipient}} resolved to a non-primitive value and was left unsubstituted',
        location: 'mjml',
      },
    ]);
    expect(result.summary).toEqual({ errors: 1, warnings: 0 });
  });

  it('is clean for a complete rendered email', async () => {
    const result = await runPreflight({
      mjml: '<mjml><mj-head><mj-preview>Peek</mj-preview></mj-head><mj-body></mj-body></mjml>',
      subject: 'Your weekly digest',
      html: '<p>Hello</p><img src="https://cdn.example/x.png" alt="Logo"><a href="https://example.com/unsubscribe">Unsubscribe</a>',
      fieldPaths: [],
      renderWarnings: [],
    });
    expect(result).toEqual({ findings: [], summary: { errors: 0, warnings: 0 } });
  });
});
