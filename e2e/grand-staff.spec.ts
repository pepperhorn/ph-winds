import { expect, test } from '@playwright/test';

const GRAND_STAFF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>1</divisions><key><fifths>0</fifths></key><time><beats>4</beats><beat-type>4</beat-type></time>
        <staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>
      </attributes>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>4</duration><voice>1</voice><staff>1</staff></note>
      <backup><duration>4</duration></backup>
      <note><pitch><step>C</step><octave>3</octave></pitch><duration>4</duration><voice>2</voice><staff>2</staff></note>
    </measure>
  </part>
</score-partwise>`;

test('uploads, renders, sizes and persists one grand staff above the cards', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Grand staff MusicXML').setInputFiles({
    name: 'piano.musicxml',
    mimeType: 'application/vnd.recordare.musicxml+xml',
    buffer: Buffer.from(GRAND_STAFF_XML),
  });

  const panel = page.locator('.wc-grand-staff-panel');
  await expect(panel.getByText('piano.musicxml')).toBeVisible();
  await expect(panel.locator('.wc-grand-staff svg').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.wc-grand-staff-panel + .wc-board-empty')).toBeVisible();

  await panel.locator('input[type="range"]').fill('1.5');
  await expect(panel.locator('.wc-grand-staff-sized')).toHaveCSS('width', /.+/);
  await expect(panel.locator('.wc-slider-value')).toHaveText('150%');

  await page.reload();
  await expect(page.locator('.wc-grand-staff-panel').getByText('piano.musicxml')).toBeVisible();
  await expect(page.locator('.wc-grand-staff-panel .wc-slider-value')).toHaveText('150%');
  await expect(page.locator('.wc-grand-staff svg').first()).toBeVisible({ timeout: 30_000 });
});
