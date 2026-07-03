/**
 * Dependency-free PWA icon generator.
 *
 * No image library is available in this environment (no sharp / PIL / ImageMagick),
 * so we encode PNGs by hand using Node's built-in `zlib`. Draws an on-brand
 * "voucher / ticket" glyph (white ticket on the brand near-black #18181b) with the
 * glyph kept inside the maskable safe zone so the same files work as both regular
 * and Android adaptive ("maskable") icons.
 *
 * Run: `node scripts/generate-icons.mjs` (also wired as `pnpm gen:icons`).
 * Outputs: public/icon-192.png, icon-512.png, apple-touch-icon.png (180).
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

// ---- colors (RGB) -------------------------------------------------------
const BG = [24, 24, 27]; // brand primary  hsl(240 5.9% 10%)  ≈ #18181b
const TICKET = [250, 250, 250]; // near-white ticket body
const AMBER = [245, 158, 11]; // accent "value" line
const GRAY = [161, 161, 170]; // placeholder text lines

// ---- tiny PNG encoder ---------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // raw scanlines, each prefixed with filter byte 0
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- scene --------------------------------------------------------------
function sdRoundRect(x, y, cx, cy, w, h, r) {
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - r; // < 0 inside
}

/** Color at a point in pixel space (S = canvas size). Returns [r,g,b]. */
function colorAt(x, y, S) {
  const cx = S / 2;
  const cy = S / 2;
  const tW = 0.58 * S;
  const tH = 0.42 * S;
  const tLeft = cx - tW / 2;
  const tR = 0.035 * S;
  const perfX = tLeft + 0.64 * tW; // perforation: wide stub left, narrow right
  const notchR = 0.05 * S;

  let col = BG;

  // ticket body
  if (sdRoundRect(x, y, cx, cy, tW, tH, tR) < 0) {
    col = TICKET;

    // content lines on the left (main) part
    const lLeft = tLeft + 0.085 * tW;
    const lRight = perfX - 0.08 * tW;
    const lW = lRight - lLeft;
    const lCx = (lLeft + lRight) / 2;
    // amber "value" bar
    if (sdRoundRect(x, y, lCx, cy - 0.11 * tH, lW * 0.96, 0.05 * S, 0.018 * S) < 0)
      col = AMBER;
    // two gray placeholder lines
    else if (
      sdRoundRect(x, y, lLeft + lW * 0.45, cy + 0.04 * tH, lW * 0.9, 0.03 * S, 0.014 * S) <
      0
    )
      col = GRAY;
    else if (
      sdRoundRect(x, y, lLeft + lW * 0.3, cy + 0.15 * tH, lW * 0.6, 0.03 * S, 0.014 * S) <
      0
    )
      col = GRAY;
  }

  // perforation notches (cut back to bg) at top & bottom of the perforation line
  if (
    Math.hypot(x - perfX, y - (cy - tH / 2)) < notchR ||
    Math.hypot(x - perfX, y - (cy + tH / 2)) < notchR
  ) {
    col = BG;
  }

  // dashed perforation line
  const dash = 0.032 * S;
  const gap = 0.022 * S;
  const period = dash + gap;
  const top = cy - tH / 2 + notchR * 0.6;
  const bottom = cy + tH / 2 - notchR * 0.6;
  if (
    Math.abs(x - perfX) < 0.011 * S &&
    y > top &&
    y < bottom &&
    (y - top) % period < dash
  ) {
    col = BG;
  }

  return col;
}

function render(S) {
  const SS = 4; // supersampling per axis
  const rgba = Buffer.alloc(S * S * 4);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          const c = colorAt(x, y, S);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const i = (py * S + px) * 4;
      rgba[i] = Math.round(r / n);
      rgba[i + 1] = Math.round(g / n);
      rgba[i + 2] = Math.round(b / n);
      rgba[i + 3] = 255; // full-bleed, opaque (correct for iOS + maskable)
    }
  }
  return encodePng(S, S, rgba);
}

for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const png = render(size);
  writeFileSync(join(PUBLIC, name), png);
  console.log(`wrote public/${name} (${size}x${size}, ${png.length} bytes)`);
}
