import { toPng } from 'html-to-image';
import { pendingRenders } from '@/notation/verovio';

function download(href: string, filename: string) {
  const a = document.createElement('a');
  a.href = href; a.download = filename; a.click();
}

export function downloadText(text: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  download(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'board';

export async function exportBoardImage(el: HTMLElement, kind: 'png' | 'pdf', name: string) {
  await pendingRenders();
  await document.fonts.ready;
  const png = await toPng(el, {
    pixelRatio: 2, backgroundColor: '#ffffff',
    filter: (n) => {
      if (n instanceof HTMLElement && n.hasAttribute('data-export-hide')) return false;
      // Chrome inputs (board title/subtitle/footer) render their placeholder
      // when empty; skip them so an unused field doesn't export as ghost text.
      if (n instanceof HTMLInputElement && n.value.trim() === '') return false;
      return true;
    },
  });
  if (kind === 'png') return download(png, `${slug(name)}.png`);
  const { jsPDF } = await import('jspdf');
  const img = new Image(); img.src = png; await img.decode();
  const landscape = img.width > img.height;
  const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 24;
  const s = Math.min((pw - 2 * m) / img.width, (ph - 2 * m) / img.height);
  pdf.addImage(png, 'PNG', (pw - img.width * s) / 2, m, img.width * s, img.height * s, undefined, 'FAST');
  pdf.save(`${slug(name)}.pdf`);
}
