import { describe, it, expect, vi } from 'vitest';

const { fakeToolkit, createVerovioModule, VerovioToolkitCtor } = vi.hoisted(() => {
  const fakeToolkit = {
    setOptions: vi.fn(),
    loadData: vi.fn(() => true),
    renderToSVG: vi.fn(() => '<svg/>'),
    getPageCount: vi.fn(() => 1),
  };
  return {
    fakeToolkit,
    createVerovioModule: vi.fn(() => Promise.resolve({})),
    VerovioToolkitCtor: vi.fn(function VerovioToolkit() {
      return fakeToolkit;
    }),
  };
});

vi.mock('verovio/wasm', () => ({ default: createVerovioModule }));
vi.mock('verovio/esm', () => ({ VerovioToolkit: VerovioToolkitCtor }));
vi.mock('./verovio-font-bravura.generated', () => ({ BRAVURA_ZIP_B64: 'bravura-b64' }));
vi.mock('./verovio-font-petaluma.generated', () => ({ PETALUMA_ZIP_B64: 'petaluma-b64' }));

import { renderMeiToSvg } from './verovio';

function fontAddCustomCalls() {
  return fakeToolkit.setOptions.mock.calls
    .map(([opts]) => opts as Record<string, unknown>)
    .filter((opts) => 'fontAddCustom' in opts);
}

describe('verovio lazy per-font registration', () => {
  it('registers only the font actually requested, and only once per font', async () => {
    await renderMeiToSvg('<mei/>', { font: 'Bravura' });
    expect(fontAddCustomCalls()).toEqual([{ fontAddCustom: ['bravura-b64'] }]);

    // Repeat render of an already-registered font: no re-registration.
    await renderMeiToSvg('<mei/>', { font: 'Bravura' });
    expect(fontAddCustomCalls()).toHaveLength(1);

    // First render requesting Petaluma registers it (and only it).
    await renderMeiToSvg('<mei/>', { font: 'Petaluma' });
    expect(fontAddCustomCalls()).toEqual([
      { fontAddCustom: ['bravura-b64'] },
      { fontAddCustom: ['petaluma-b64'] },
    ]);

    // Switching back and forth between already-used fonts registers neither again.
    await renderMeiToSvg('<mei/>', { font: 'Bravura' });
    await renderMeiToSvg('<mei/>', { font: 'Petaluma' });
    expect(fontAddCustomCalls()).toHaveLength(2);
  });
});
