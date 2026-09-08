/** Installed-app proof. These tiny fixtures need only shipped runtime dependencies. */
import { pathToFileURL } from 'node:url';
import { documentCapabilities, extractDocuments } from './index.js';

function textPdf(text: string): Buffer {
  const stream = `BT /F1 20 Tf 40 700 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let file = '%PDF-1.7\n';
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(file));
    file += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(file);
  file += `xref\n0 6\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(file);
}

export async function smokeDocumentReading(): Promise<void> {
  if (!documentCapabilities().ocr.available) throw new Error('Packaged offline OCR language assets are missing');
  const { createCanvas } = await import('@napi-rs/canvas');
  const canvas = createCanvas(1100, 190);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, 1100, 190);
  context.fillStyle = 'black'; context.font = '46px sans-serif';
  context.fillText('WARDEN OFFLINE DOCUMENT CHECK', 24, 105);
  const documents = await extractDocuments([
    { name: 'smoke.pdf', data: textPdf('WARDEN PDF DOCUMENT CHECK').toString('base64') },
    { name: 'smoke.png', data: canvas.toBuffer('image/png').toString('base64') }
  ], { timeoutMs: 45_000 });
  const pdf = documents[0];
  const image = documents[1];
  if (pdf?.report.status !== 'read' || pdf.report.method !== 'pdf' || !pdf.text.includes('WARDEN PDF DOCUMENT CHECK')) {
    throw new Error(`Packaged PDF reader failed: ${pdf?.report.reason ?? 'expected text missing'}`);
  }
  if (image?.report.status !== 'read' || image.report.method !== 'ocr' || !image.text.includes('WARDEN OFFLINE DOCUMENT CHECK')) {
    throw new Error(`Packaged OCR reader failed: ${image?.report.reason ?? 'expected text missing'}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await smokeDocumentReading(); console.log('WARDEN_DOCUMENT_SMOKE_OK'); }
  catch (error) { console.error(`WARDEN_DOCUMENT_SMOKE_FAIL: ${error instanceof Error ? error.message : 'extraction failed'}`); process.exitCode = 1; }
}
