import { describe, expect, it } from 'bun:test';
import { deriveTextFromHtml } from '@template/email/render/deriveTextFromHtml';

describe('deriveTextFromHtml', () => {
  it('extracts body text and drops head, style, and script content', () => {
    const html =
      '<html><head><title>t</title><style>.a{color:red}</style></head>' +
      '<body><style>.b{}</style><p>Hello</p><script>evil()</script></body></html>';
    expect(deriveTextFromHtml(html)).toBe('Hello');
  });

  it('turns block boundaries and line breaks into newlines', () => {
    const html = '<p>First</p><div>Second<br>Third</div><table><tr><td>Fourth</td></tr></table>';
    expect(deriveTextFromHtml(html)).toBe('First\nSecond\nThird\nFourth');
  });

  it('keeps link targets next to their labels', () => {
    const html = '<p>Visit <a href="https://acme.test/offer">our offer</a> today</p>';
    expect(deriveTextFromHtml(html)).toBe('Visit our offer (https://acme.test/offer) today');
  });

  it('does not repeat a link whose label already is the target', () => {
    const html = '<a href="https://acme.test">https://acme.test</a>';
    expect(deriveTextFromHtml(html)).toBe('https://acme.test');
  });

  it('decodes entities and treats non-breaking spaces as spaces', () => {
    const html = '<p>Tom&nbsp;&amp;&nbsp;Jerry &lt;3 &quot;cheese&quot;&#39;s</p>';
    expect(deriveTextFromHtml(html)).toBe('Tom & Jerry <3 "cheese"\'s');
  });

  it('collapses runs of blank lines to a single blank line and trims', () => {
    const html = '<div><p>One</p></div><div></div><div><p></p></div><div><p>Two</p></div>';
    expect(deriveTextFromHtml(html)).toBe('One\n\nTwo');
  });
});

describe('deriveTextFromHtml — quoted attributes and entity coverage', () => {
  it('a quoted attribute containing > does not leak tag garbage into the text', () => {
    const html = '<td title="x > y">Cell</td>';
    expect(deriveTextFromHtml(html)).toBe('Cell');
  });

  it('an image contributes its alt text instead of attribute garbage', () => {
    const html = '<p>Before <img alt="a > b" src="https://cdn.test/i.png"> after</p>';
    expect(deriveTextFromHtml(html)).toBe('Before a > b after');
  });

  it('decodes numeric, hex, and common named entities so text matches the rendered HTML', () => {
    const html = '<p>Price &copy; &#169; &#x1F600;</p>';
    expect(deriveTextFromHtml(html)).toBe('Price © © \u{1F600}');
  });
});
