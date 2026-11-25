// Génère les icônes PNG de l'app (sans dépendance) : une onde dorée dans un cercle, sur la nuit.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const S = 4; // suréchantillonnage
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const c = pixel((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size);
        acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
      }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = Math.round(acc[0] / (S * S)); raw[o + 1] = Math.round(acc[1] / (S * S)); raw[o + 2] = Math.round(acc[2] / (S * S)); raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.max(0, Math.min(1, t)));
const NIGHT = [12, 9, 24], DEEP = [26, 18, 38], PEACH = [255, 207, 180], GOLD = [255, 228, 176];
function icon(u, v) {
  const dx = u - 0.5, dy = v - 0.5, r = Math.hypot(dx, dy);
  let c = mix(DEEP, NIGHT, r / 0.7);
  // Halo doux.
  c = mix(c, PEACH, Math.max(0, 0.16 - Math.abs(r - 0.3)) * 0.9);
  // Anneau fin.
  c = mix(c, PEACH, Math.max(0, 1 - Math.abs(r - 0.3) / 0.012) * 0.55);
  // L'onde : le chant, à l'intérieur du cercle.
  if (Math.abs(dx) < 0.23) {
    const wy = 0.5 + 0.085 * Math.sin((dx / 0.23) * Math.PI * 1.5) * Math.cos(dx / 0.23 * Math.PI * 0.5);
    const d = Math.abs(v - wy);
    c = mix(c, GOLD, Math.max(0, 1 - d / 0.02));
    c = mix(c, PEACH, Math.max(0, 0.05 - d) * 4);
  }
  return c;
}
for (const s of [192, 512]) writeFileSync(new URL(`../public/icons/icon-${s}.png`, import.meta.url), png(s, icon));
// Icône « maskable » : même dessin, plus petit, dans la zone sûre.
writeFileSync(new URL('../public/icons/icon-maskable-512.png', import.meta.url), png(512, (u, v) => icon(0.5 + (u - 0.5) * 1.25, 0.5 + (v - 0.5) * 1.25)));
console.log('icônes écrites');
