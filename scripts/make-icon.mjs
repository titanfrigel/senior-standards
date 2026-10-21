import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 512;
const BG = [0x1f, 0x29, 0x37, 255];
const FG = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

function inRoundedSquare(x, y, r) {
  const cx = Math.min(Math.max(x, r), SIZE - 1 - r);
  const cy = Math.min(Math.max(y, r), SIZE - 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

// Shield: flat top, straight sides down to y=300, then tapering to a point.
function inShield(x, y, half, top, bottom) {
  const mid = SIZE / 2;
  if (y < top || y > bottom) return false;
  const shoulder = top + (bottom - top) * 0.55;
  if (y <= shoulder) return Math.abs(x - mid) <= half;
  const t = (y - shoulder) / (bottom - shoulder);
  return Math.abs(x - mid) <= half * (1 - t);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)),
  );
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pixel(x, y) {
  if (!inRoundedSquare(x, y, 96)) return CLEAR;
  if (!inShield(x, y, 150, 100, 420)) return BG;
  const onCheck =
    distToSegment(x, y, 198, 262, 238, 306) <= 15 ||
    distToSegment(x, y, 238, 306, 322, 210) <= 15;
  return onCheck ? BG : FG;
}

const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 4 + 1);
  for (let x = 0; x < SIZE; x++) raw.set(pixel(x, y), row + 1 + x * 4);
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".claude-plugin",
  "icon.png",
);
writeFileSync(out, png);
