// Rasterizes the DevFeed logo to PNG icons without extra deps.
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

// Signed distance helpers in 32x32 logo space.
const sdRoundRect = (x, y, r) => {
  const qx = Math.abs(x - 16) - (16 - r);
  const qy = Math.abs(y - 16) - (16 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const sdSegment = (px, py, ax, ay, bx, by) => {
  const pax = px - ax, pay = py - ay, bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
};
const segments = [
  [11.5, 10.5, 6.5, 16], [6.5, 16, 11.5, 21.5],
  [20.5, 10.5, 25.5, 16], [25.5, 16, 20.5, 21.5],
  [17.5, 9, 14.5, 23],
];
const ink = [0x0a, 0x0a, 0x0a];

const render = (size) => {
  const s = 32 / size;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5) * s, y = (py + 0.5) * s;
      const bg = Math.max(0, Math.min(1, 0.5 - sdRoundRect(x, y, 0) / s));
      const dLine = Math.min(...segments.map((g) => sdSegment(x, y, ...g))) - 1.3;
      const fg = Math.max(0, Math.min(1, 0.5 - dLine / s));
      const o = py * (size * 4 + 1) + 1 + px * 4;
      for (let i = 0; i < 3; i++) {
        raw[o + i] = Math.round(ink[i] + (255 - ink[i]) * fg);
      }
      raw[o + 3] = Math.round(bg * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

for (const size of [16, 32, 48, 128]) {
  writeFileSync(new URL(`../public/icons/icon-${size}.png`, import.meta.url), render(size));
}
