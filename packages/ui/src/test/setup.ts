// Test setup — preloaded by bunfig.toml before each test file.
// Provide minimal DOM stubs so libraries like sonner that inject CSS
// at module-load time don't crash in non-browser environments.
if (typeof globalThis.document === 'undefined') {
  const noop = () => {};
  const headEl = { appendChild: noop };
  (globalThis as Record<string, unknown>).document = {
    head: headEl,
    getElementsByTagName: () => [headEl],
    createElement: () => ({ appendChild: noop, styleSheet: null }),
    createTextNode: (text: string) => ({ textContent: text }),
  };
}
