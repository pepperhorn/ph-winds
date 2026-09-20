import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { parsePitch } from '@/music/pitch';

// Every other suite mocks `StaffNote` out entirely, so nothing exercises its
// three loading branches (toolkit-loading spinner, light per-note skeleton,
// error state) against the real component. Mock `@/notation/verovio`
// instead, with controllable readiness flags and a controllable render
// promise, so each branch can be driven directly.
const state = vi.hoisted(() => ({
  toolkitReady: false,
  fontReady: false,
}));

const { renderStaffSvg } = vi.hoisted(() => ({ renderStaffSvg: vi.fn() }));

vi.mock('./verovio', () => ({
  musicFontToVerovioFont: (f: string) => (f === 'petaluma' ? 'Petaluma' : 'Bravura'),
  isVerovioReady: () => state.toolkitReady,
  onVerovioReady: (cb: () => void) => {
    if (state.toolkitReady) queueMicrotask(cb);
    return () => {};
  },
  isFontRegistered: () => state.fontReady,
  onFontReady: (_font: string, cb: () => void) => {
    if (state.fontReady) queueMicrotask(cb);
    return () => {};
  },
  renderStaffSvg,
}));

import { StaffNote } from './StaffNote';

const pitch = parsePitch('C5');

beforeEach(() => {
  state.toolkitReady = false;
  state.fontReady = false;
  renderStaffSvg.mockReset();
});

describe('StaffNote loading states', () => {
  it('shows the "Loading notation…" spinner while the toolkit is not ready', () => {
    renderStaffSvg.mockReturnValue(new Promise(() => {})); // never resolves in this test
    const { container } = render(<StaffNote pitch={pitch} clef="G" font="bravura" width={150} />);
    expect(screen.getByText('Loading notation…')).toBeInTheDocument();
    expect(container.querySelector('.wc-staff-loading')).not.toBeNull();
    expect(container.querySelector('.wc-staff-spinner')).not.toBeNull();
  });

  it('shows the "Loading notation…" spinner while the toolkit is ready but this font is not registered yet', () => {
    state.toolkitReady = true;
    state.fontReady = false;
    renderStaffSvg.mockReturnValue(new Promise(() => {}));
    const { container } = render(<StaffNote pitch={pitch} clef="G" font="petaluma" width={150} />);
    expect(screen.getByText('Loading notation…')).toBeInTheDocument();
    expect(container.querySelector('.wc-staff-loading')).not.toBeNull();
  });

  it('shows the light skeleton once the toolkit and font are ready but this note is still queued', () => {
    state.toolkitReady = true;
    state.fontReady = true;
    renderStaffSvg.mockReturnValue(new Promise(() => {})); // pending render
    const { container } = render(<StaffNote pitch={pitch} clef="G" font="bravura" width={150} />);
    expect(screen.queryByText('Loading notation…')).toBeNull();
    expect(container.querySelector('.wc-staff-loading')).toBeNull();
    expect(container.querySelector('.wc-staff--loading')).not.toBeNull();
  });

  it('shows "Notation unavailable" after the render rejects', async () => {
    state.toolkitReady = true;
    state.fontReady = true;
    renderStaffSvg.mockReturnValue(Promise.reject(new Error('engrave failed')));
    render(<StaffNote pitch={pitch} clef="G" font="bravura" width={150} />);
    await waitFor(() => expect(screen.getByText('Notation unavailable')).toBeInTheDocument());
  });

  it('renders the engraved SVG once the render resolves', async () => {
    state.toolkitReady = true;
    state.fontReady = true;
    renderStaffSvg.mockReturnValue(Promise.resolve('<svg><path d="M0 0"/></svg>'));
    const { container } = render(<StaffNote pitch={pitch} clef="G" font="bravura" width={150} />);
    await waitFor(() => expect(container.querySelector('.wc-staff path')).not.toBeNull());
  });
});
