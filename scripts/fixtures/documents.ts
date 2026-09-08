/** Small, valid file fixtures built in memory, independent of the extraction implementation. */
import { crc32, deflateRawSync } from 'node:zlib';
import { createCanvas } from '@napi-rs/canvas';

export function zipFixture(entries: Array<{ name: string; text: string | Buffer; advertisedBytes?: number; encrypted?: boolean }>): Buffer {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const bytes = Buffer.from(entry.text);
    const compressed = deflateRawSync(bytes);
    const size = entry.advertisedBytes ?? bytes.length;
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(entry.encrypted ? 1 : 0, 6);
    header.writeUInt16LE(8, 8); header.writeUInt32LE(crc32(bytes), 14); header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(size, 22); header.writeUInt16LE(name.length, 26);
    local.push(header, name, compressed);
    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6);
    record.writeUInt16LE(entry.encrypted ? 1 : 0, 8); record.writeUInt16LE(8, 10);
    record.writeUInt32LE(crc32(bytes), 16); record.writeUInt32LE(compressed.length, 20); record.writeUInt32LE(size, 24);
    record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
    central.push(record, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

export function docxFixture(text: string, extra: Array<{ name: string; text: string | Buffer; advertisedBytes?: number; encrypted?: boolean }> = []): Buffer {
  return zipFixture([
    { name: '[Content_Types].xml', text: '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: 'word/document.xml', text: `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>` },
    ...extra
  ]);
}

export function imageFixture(text: string, format: 'png' | 'jpeg' = 'png'): Buffer {
  const canvas = createCanvas(1400, 320);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#000000'; context.font = '42px sans-serif';
  const lines = text.split('\n');
  lines.forEach((line, n) => context.fillText(line, 28, 78 + n * 70));
  return format === 'jpeg' ? canvas.toBuffer('image/jpeg') : canvas.toBuffer('image/png');
}

function stream(bytes: Buffer, extra = ''): Buffer {
  return Buffer.concat([Buffer.from(`<< /Length ${bytes.length}${extra ? ` ${extra}` : ''} >>\nstream\n`), bytes, Buffer.from('\nendstream')]);
}

/** Visible glyphs represented only by vector paths: no PDF text or image object. */
function vectorTextPaths(text: string): string {
  const canvas = createCanvas(1400, 160);
  const context = canvas.getContext('2d');
  context.fillStyle = 'white'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = 'black'; context.font = '72px sans-serif';
  context.fillText(text, 20, 110);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const paths: string[] = ['q 0.38 0 0 0.38 36 480 cm 0 g'];
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width;) {
      if (pixels[(y * canvas.width + x) * 4]! >= 128) { x++; continue; }
      const start = x++;
      while (x < canvas.width && pixels[(y * canvas.width + x) * 4]! < 128) x++;
      paths.push(`${start} ${canvas.height - y - 1} ${x - start} 1 re`);
    }
  }
  paths.push('f Q');
  return paths.join('\n');
}

/** PDF objects, content streams and xref offsets; image bytes are a real JPEG. */
export function pdfFixture(pages: Array<{ text?: string; image?: Buffer; width?: number; height?: number; vectorText?: string }>): Buffer {
  const objects: Buffer[] = [Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'), Buffer.alloc(0), Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')];
  const pageRefs: string[] = [];
  for (const page of pages) {
    const pageNumber = objects.length + 1;
    const contentNumber = pageNumber + 1;
    const imageNumber = pageNumber + 2;
    const commands = [page.text ? `BT /F1 18 Tf 40 740 Td (${page.text.replace(/[\\()]/g, '\\$&')}) Tj ET` : '', page.image ? 'q 540 0 0 125 36 480 cm /Im0 Do Q' : '', page.vectorText ? vectorTextPaths(page.vectorText) : ''].join('\n');
    objects.push(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> ${page.image ? `/XObject << /Im0 ${imageNumber} 0 R >>` : ''} >> /Contents ${contentNumber} 0 R >>`));
    objects.push(stream(Buffer.from(commands)));
    if (page.image) objects.push(stream(page.image, `/Type /XObject /Subtype /Image /Width ${page.width ?? 1400} /Height ${page.height ?? 320} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`));
    pageRefs.push(`${pageNumber} 0 R`);
  }
  objects[1] = Buffer.from(`<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.join(' ')}] >>`);
  const chunks: Buffer[] = [Buffer.from('%PDF-1.7\n')];
  const offsets = [0];
  let length = chunks[0]!.length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from('\nendobj\n')]);
    chunks.push(chunk); length += chunk.length;
  });
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF`));
  return Buffer.concat(chunks);
}
