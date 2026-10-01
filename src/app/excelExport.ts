import type { ExportTabel } from '../core/export';

const STATUS_KLEUR: Record<string, string> = {
  // Light tints of the house-style status colours
  Afgerond: 'FFDCEFE5',
  'Alles afgerond': 'FFDCEFE5',
  Bezig: 'FFF6E7D3',
  'Niet gestart': 'FFF5DCE2',
};

/**
 * Writes the export as .xlsx in the browser (exceljs, loaded on demand) and offers it as a
 * download. Nothing is sent over the network.
 */
export async function downloadExcel(tabel: ExportTabel, selectie: [string, string][], bestandsnaam: string): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Dashboard AI & data trainingsprogramma';
  wb.created = new Date();

  const ws = wb.addWorksheet('Medewerkers × training', { views: [{ state: 'frozen', ySplit: 1, xSplit: 1 }] });
  ws.addRow(tabel.kolommen);
  for (const rij of tabel.rijen) ws.addRow(rij);

  const kop = ws.getRow(1);
  kop.font = { bold: true, color: { argb: 'FF47121F' } };
  kop.alignment = { vertical: 'bottom', wrapText: true };
  kop.height = 32;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: tabel.kolommen.length } };

  tabel.soorten.forEach((soort, i) => {
    const kolom = ws.getColumn(i + 1);
    const breedste = Math.max(tabel.kolommen[i].length * 0.75, ...tabel.rijen.slice(0, 500).map((r) => String(r[i] ?? '').length));
    kolom.width = Math.min(Math.max(soort === 'percentage' ? 12 : 10, breedste + 2), 45);
    if (soort === 'percentage') kolom.numFmt = '0%';
    if (soort === 'status') {
      kolom.eachCell({ includeEmpty: false }, (cel, rijNr) => {
        const kleur = rijNr > 1 ? STATUS_KLEUR[String(cel.value)] : undefined;
        if (kleur) cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kleur } };
      });
    }
  });

  const info = wb.addWorksheet('Selectie');
  info.addRow(['Export van het dashboard AI & data trainingsprogramma']).font = { bold: true };
  info.addRow(['Geëxporteerd op', new Date().toLocaleString('nl-NL')]);
  info.addRow(['Aantal medewerkers', tabel.rijen.length]);
  info.addRow([]);
  info.addRow(['Filter', 'Waarde']).font = { bold: true };
  for (const [k, v] of selectie) info.addRow([k, v]);
  info.addRow([]);
  info.addRow(['Let op: dit bestand bevat persoonsgegevens. Deel het alleen met wie daar recht op heeft.']).font = { italic: true };
  info.getColumn(1).width = 22;
  info.getColumn(2).width = 80;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
