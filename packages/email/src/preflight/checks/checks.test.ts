import { describe, expect, it } from 'bun:test';
import { imagesHaveAlt } from '@template/email/preflight/checks/imagesHaveAlt';
import { preheaderPresent } from '@template/email/preflight/checks/preheaderPresent';
import { spamTriggerPhrases } from '@template/email/preflight/checks/spamTriggerPhrases';
import { subjectPresent } from '@template/email/preflight/checks/subjectPresent';
import { unresolvedLensPaths } from '@template/email/preflight/checks/unresolvedLensPaths';
import { unsubscribeLinkPresent } from '@template/email/preflight/checks/unsubscribeLinkPresent';
import type { PreflightInput } from '@template/email/preflight/types';
import { visibleText } from '@template/email/preflight/visibleText';
import { emailProjection, emailSurface } from '@template/email/rules/emailProjection';
import mjml2html from 'mjml';

const input = (over: Partial<PreflightInput> = {}): PreflightInput => ({
  mjml: '<mjml><mj-body></mj-body></mjml>',
  subject: 'Hello',
  html: '<html><body><p>Hi</p></body></html>',
  fieldPaths: [],
  renderWarnings: [],
  ...over,
});

const surface = () => emailSurface(emailProjection());

describe('preflight checks', () => {
  it('flags a blank rendered subject as an error', () => {
    expect(subjectPresent(input({ subject: '   ' }))).toEqual([
      {
        code: 'subject.missing',
        severity: 'error',
        message: 'The email renders with no subject.',
        location: 'subject',
      },
    ]);
    expect(subjectPresent(input())).toEqual([]);
  });

  it('flags composed MJML without a real <mj-preview> element as a missing preheader', () => {
    expect(preheaderPresent(input())[0]?.code).toBe('preheader.missing');
    expect(
      preheaderPresent(
        input({ mjml: '<mjml><mj-head><!-- <mj-preview>Commented out</mj-preview> --></mj-head></mjml>' }),
      )[0]?.code,
    ).toBe('preheader.missing');
    expect(preheaderPresent(input({ mjml: '<mjml><mj-head><mj-preview>Peek</mj-preview></mj-head></mjml>' }))).toEqual(
      [],
    );
  });

  it('looks for an unsubscribe link in the rendered anchors, wherever it came from', () => {
    expect(unsubscribeLinkPresent(input())[0]?.code).toBe('unsubscribe.missing');
    expect(
      unsubscribeLinkPresent(
        input({ html: '<table><tr><td><a href="https://example.com/unsubscribe">Opt out</a></td></tr></table>' }),
      ),
    ).toEqual([]);
    expect(unsubscribeLinkPresent(input({ html: '<p>See https://example.com/unsubscribe</p>' }))[0]?.code).toBe(
      'unsubscribe.missing',
    );
  });

  it('reports each rendered image without alt text, located by its src', () => {
    const html =
      '<img src="https://cdn.example/a.png" alt="A"><div><img src="https://cdn.example/b.png"></div><img alt="  " src="https://cdn.example/c.png">';
    const findings = imagesHaveAlt(input({ html }));
    expect(findings.map((finding) => finding.location)).toEqual([
      'https://cdn.example/b.png',
      'https://cdn.example/c.png',
    ]);
    expect(findings.every((finding) => finding.code === 'image.alt.missing' && finding.severity === 'warning')).toBe(
      true,
    );
  });

  it('flags an MJML image with no alt, because the renderer emits alt="" for it', async () => {
    const { html } = await mjml2html(
      '<mjml><mj-body><mj-section><mj-column><mj-image src="https://cdn.example/hero.png" /></mj-column></mj-section></mj-body></mjml>',
      { validationLevel: 'skip' },
    );

    expect(imagesHaveAlt(input({ html })).map((finding) => finding.code)).toEqual(['image.alt.missing']);
  });

  it('asks the lens whether each field path resolves, and is silent without a lens', () => {
    const findings = unresolvedLensPaths(
      input({ fieldPaths: ['recipient.name', 'recipient.not_a_field'], lens: surface() }),
    );
    expect(
      findings.filter((finding) => finding.code === 'token.unresolved').map((finding) => finding.location),
    ).toEqual(['recipient.not_a_field']);
    expect(unresolvedLensPaths(input({ fieldPaths: ['recipient.not_a_field'] }))).toEqual([]);
  });

  it('uses the requested severity when the supplied lens cannot resolve a path', () => {
    const findings = unresolvedLensPaths(
      input({ fieldPaths: ['recipient.nickname'], lens: surface(), tokenUnresolvedSeverity: 'warning' }),
    );

    expect(findings).toEqual([
      {
        code: 'token.unresolved',
        severity: 'warning',
        message: "{{recipient.nickname}} does not resolve for this template's recipient, sender or data.",
        location: 'recipient.nickname',
      },
    ]);
  });

  it('reports a path beneath a Json field as token.opaque', () => {
    const findings = unresolvedLensPaths(input({ fieldPaths: ['data.mission.uuid'], lens: surface() }));

    expect(findings).toHaveLength(1);
    expect(findings[0]?.code).toBe('token.opaque');
    expect(findings[0]?.severity).toBe('warning');
  });

  it('flags spam-trigger phrases in the subject and in visible body text only', () => {
    const html =
      '<style>.x{content:"act now"}</style><p>Buy now, it is <b>risk-free</b>!</p><script>var s="winner"</script>';
    const findings = spamTriggerPhrases(input({ subject: 'URGENT: winner inside', html }));
    expect(findings.map((finding) => [finding.location, finding.message])).toEqual([
      ['subject', '"winner" is a common spam-filter trigger.'],
      ['subject', '"urgent" is a common spam-filter trigger.'],
      ['body', '"risk-free" is a common spam-filter trigger.'],
      ['body', '"buy now" is a common spam-filter trigger.'],
    ]);
  });

  it('decodes entities and drops scripts and styles when extracting visible text', () => {
    expect(visibleText('<style>p{}</style><p>Hello&nbsp;<b>there</b> &amp; you</p><script>1</script>')).toBe(
      'Hello there & you',
    );
  });
});
