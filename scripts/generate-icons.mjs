// Generates placeholder PWA icons (solid brand-color squares with a centered
// "N" mark) as raw PNGs using only Node's zlib — no image library dependency.
// These are swappable later once real brand assets exist (see plan Section 10).
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [2, 6, 23]; // #020617
const FG = [16, 185, 129]; // emerald-500, the "N" mark

function crc(buf) {
  // Node's zlib doesn't export crc32 publicly in older versions; implement a
  // small table-based CRC32 as a fallback.
  let c;
  const table = crc.table ?? (crc.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function isInsideN(x, y, size) {
  // Simple bold "N" glyph drawn as three strokes within a centered square.
  const margin = size * 0.28;
  const strokeW = size * 0.12;
  const top = margin;
  const bottom = size - margin;
  const left = margin;
  const right = size - margin;
  if (y < top || y > bottom) return false;
  // left vertical stroke
  if (x >= left && x <= left + strokeW) return true;
  // right vertical stroke
  if (x >= right - strokeW && x <= right) return true;
  // diagonal stroke
  const t = (y - top) / (bottom - top);
  const diagX = left + t * (right - left);
  if (x >= diagX - strokeW * 0.9 && x <= diagX + strokeW * 0.9) return true;
  return false;
}

function generatePng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = isInsideN(x, y, size) ? FG : BG;
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
      raw[offset++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = deflateSync(raw);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, generatePng(size));
  writeFileSync(`public/icons/maskable-${size}.png`, generatePng(size));
}
writeFileSync("public/icons/apple-touch-icon.png", generatePng(180));
console.log("Generated placeholder PWA icons in public/icons/");
