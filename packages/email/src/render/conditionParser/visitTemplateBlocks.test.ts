import { describe, expect, it } from 'bun:test';
import { visitTemplateBlocks } from '@template/email/render/conditionParser/visitTemplateBlocks';
import { collectHydrationPaths } from '@template/email/rules/collectHydrationPaths';

const loopBindings = (content: string) => {
  const seen: Array<[string, string | undefined][]> = [];
  visitTemplateBlocks(content, {
    loop: (_block, { bindings }) => {
      seen.push([...bindings]);
    },
  });
  return seen;
};

describe('visitTemplateBlocks', () => {
  it('binds a valid as and index for the loop body', () => {
    expect(loopBindings('{{#each data.items as=item index=i}}x{{/each}}')).toEqual([
      [
        ['item', 'data.items'],
        ['i', undefined],
      ],
    ]);
  });

  it('binds no reserved or invalid as or index', () => {
    expect(loopBindings('{{#each data.items as=recipient index=data}}x{{/each}}')).toEqual([[]]);
    expect(loopBindings('{{#each data.items as=Item index=9i}}x{{/each}}')).toEqual([[]]);
  });

  it('leaves a root a reserved as names unshadowed in the other walkers', () => {
    const { fieldPaths } = collectHydrationPaths(
      '{{#each data.items as=recipient}}{{recipient.name}}{{/each}}',
    );
    expect(fieldPaths).toContain('recipient.name');
    expect(fieldPaths).not.toContain('data.items.name');
  });

  it('records the field a {{datetime}} token prints and any { path } magnitudes in its expression or offset', () => {
    expect(
      collectHydrationPaths(
        [
          '<mjml><mj-body>',
          '{{datetime data.request.lastScheduledAt offset={"ahead":{"days":{"path":"data.graceDays"}}} tz=America/New_York}}',
          '{{datetime {"ahead":{"weeks":{"path":"recipient.trialWeeks"}}}}}',
          '{{datetime now format="yyyy-MM-dd"}}',
          '{{datetime "2026-12-01T00:00:00Z"}}',
          '{{#each data.calls as=call}}{{datetime call.at offset={"ago":{"hours":{"path":"call.leadHours"}}}}}{{/each}}',
          '</mj-body></mjml>',
        ].join(''),
      ).fieldPaths,
    ).toEqual([
      'data.request.lastScheduledAt',
      'data.graceDays',
      'recipient.trialWeeks',
      'data.calls',
      'data.calls.at',
      'data.calls.leadHours',
    ]);
  });
});
