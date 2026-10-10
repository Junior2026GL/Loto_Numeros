// Genera el ícono de la pestaña (favicon): una bola de lotería dorada con un 7.
//
//   node scripts/generate-favicon.mjs
//
// Crea public/favicon.ico (16, 32 y 48 px) y public/favicon.svg. No necesita dependencias:
// dibuja los píxeles directamente y los guarda como PNG dentro del .ico.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const GOLD_LIGHT = [255, 244, 194];
const GOLD_MID = [255, 211, 77];
const GOLD_DARK = [232, 164, 0];
const WHITE = [255, 255, 255];
const INK = [59, 42, 0];

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Distancia de un punto a un segmento (para dibujar los trazos del 7). */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Color (RGBA) de un punto en coordenadas de -1 a 1; transparente fuera de la bola. */
function sample(x, y) {
  const r = Math.hypot(x, y);
  if (r > 0.96) return [0, 0, 0, 0];

  // Bola: degradado radial con el brillo arriba a la izquierda.
  const d = Math.hypot(x + 0.3, y + 0.34) / 1.45;
  let color = d < 0.42 ? mix(GOLD_LIGHT, GOLD_MID, d / 0.42) : mix(GOLD_MID, GOLD_DARK, Math.min(1, (d - 0.42) / 0.58));

  // Disco blanco central con el número.
  if (r < 0.6) {
    color = WHITE;
    const bar = Math.abs(y + 0.3) < 0.1 && Math.abs(x) < 0.34;
    const stroke = distanceToSegment(x, y, 0.34, -0.3, -0.12, 0.38) < 0.115;
    if (bar || stroke) color = INK;
  }
  return [...color, 255];
}

/** Rasteriza `size` x `size` píxeles con suavizado (4x4 muestras por píxel). */
function render(size) {
  const samples = 4;
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          const x = ((px + (sx + 0.5) / samples) / size) * 2 - 1;
          const y = ((py + (sy + 0.5) / samples) / size) * 2 - 1;
          const [cr, cg, cb, ca] = sample(x, y);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const offset = (py * size + px) * 4;
      const n = samples * samples;
      pixels[offset] = a ? Math.round(r / a) : 0;
      pixels[offset + 1] = a ? Math.round(g / a) : 0;
      pixels[offset + 2] = a ? Math.round(b / a) : 0;
      pixels[offset + 3] = Math.round(a / n);
    }
  }
  return pixels;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(zlib.crc32(body), body.length + 4);
  return out;
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // 8 bits por canal
  header[9] = 6; // RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function encodeIco(sizes) {
  const images = sizes.map((size) => encodePng(size, render(size)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // tipo: ícono
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = sizes.map((size, i) => {
    const entry = Buffer.alloc(16);
    entry[0] = size;
    entry[1] = size;
    entry.writeUInt16LE(1, 4); // planos
    entry.writeUInt16LE(32, 6); // bits por píxel
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += images[i].length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <radialGradient id="g" cx="35%" cy="32%" r="75%">
      <stop offset="0" stop-color="#fff4c2"/>
      <stop offset="0.42" stop-color="#ffd34d"/>
      <stop offset="1" stop-color="#e8a400"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30.7" fill="url(#g)"/>
  <circle cx="32" cy="32" r="19.2" fill="#fff"/>
  <path d="M21 22.4h22M42 22.8 28 44" fill="none" stroke="#3b2a00" stroke-width="7.2" stroke-linecap="butt" stroke-linejoin="round"/>
</svg>
`;

writeFileSync(join(publicDir, 'favicon.ico'), encodeIco([16, 32, 48]));
writeFileSync(join(publicDir, 'favicon.svg'), svg);
