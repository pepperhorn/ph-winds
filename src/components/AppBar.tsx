import { useRef } from 'react';
import { Button } from './ui';

export function AppBar({ onNew, onImport, onExportJson, onExportPng, onExportPdf, onAbout }: {
  onNew(): void; onImport(f: File): void; onExportJson(): void; onExportPng(): void; onExportPdf(): void; onAbout(): void;
}) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <header className="wc-appbar sticky top-0 z-30 mb-6 flex flex-wrap items-center gap-2 border-b border-hairline bg-canvas/80 px-6 py-3 backdrop-blur">
      <h1 className="wc-wordmark mr-auto text-xl font-semibold tracking-tight">ph<span className="text-accent">·</span>winds</h1>
      <Button variant="text" onClick={onNew} className="btn-new">New</Button>
      <Button variant="text" onClick={() => file.current?.click()} className="btn-import">Import</Button>
      <input ref={file} type="file" accept="application/json,.json" hidden className="wc-import-input"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ''; }} />
      <Button variant="text" onClick={onExportJson} className="btn-export-json">JSON</Button>
      <Button variant="tonal" onClick={onExportPng} className="btn-export-png">PNG</Button>
      <Button variant="tonal" onClick={onExportPdf} className="btn-export-pdf">PDF</Button>
      <Button variant="text" onClick={onAbout} aria-label="About" className="btn-about">ⓘ</Button>
    </header>
  );
}
