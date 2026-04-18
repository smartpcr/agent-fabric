/**
 * Generate placeholder screenshot PNGs for the user-guide tutorial.
 *
 * Creates simple colored images with descriptive text rendered as a
 * visual label. Uses only Node.js built-in modules (no deps required).
 *
 * Run:  node scripts/generate-doc-screenshots.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../docs/user-guide/screenshots");

const WIDTH = 800;
const HEIGHT = 400;

/**
 * Build a minimal valid PNG file with a solid-color background and a
 * centered label bar.
 */
function createPng(bgColor, labelColor, label) {
  // ── raw image data (unfiltered scanlines) ──
  const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3)); // filter byte + RGB per pixel
  const labelBarTop = Math.floor(HEIGHT * 0.40);
  const labelBarBottom = Math.floor(HEIGHT * 0.60);

  for (let y = 0; y < HEIGHT; y++) {
    const rowOffset = y * (1 + WIDTH * 3);
    raw[rowOffset] = 0; // filter: None
    for (let x = 0; x < WIDTH; x++) {
      const px = rowOffset + 1 + x * 3;
      const inBar = y >= labelBarTop && y < labelBarBottom;
      const color = inBar ? labelColor : bgColor;
      raw[px] = color[0];
      raw[px + 1] = color[1];
      raw[px + 2] = color[2];
    }
  }

  const compressed = deflateSync(raw);

  // ── PNG assembly ──
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeB = Buffer.from(type, "ascii");
    const crcInput = Buffer.concat([typeB, data]);
    const crc = Buffer.alloc(4);
    crc.writeInt32BE(crc32(crcInput), 0);
    return Buffer.concat([len, typeB, data, crc]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0);
  ihdr.writeUInt32BE(HEIGHT, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // tEXt (embed label as metadata so the intent is inspectable)
  const keyword = Buffer.from("Description\0" + label, "latin1");

  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("tEXt", keyword),
    chunk("IDAT", compressed),
    chunk("IEND", iend),
  ]);
}

// ── CRC-32 (ISO 3309) ──
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return crc ^ -1;
}

// ── Screenshot definitions ──
const screenshots = [
  {
    name: "editor-layout.png",
    bg: [30, 41, 59],     // slate-800
    bar: [59, 130, 246],  // blue-500
    label: "Editor Layout — Palette | Canvas | Property Grid",
  },
  {
    name: "add-node.png",
    bg: [30, 41, 59],
    bar: [16, 185, 129],  // emerald-500
    label: "Drag Task node from Palette onto Canvas",
  },
  {
    name: "connect-nodes.png",
    bg: [30, 41, 59],
    bar: [245, 158, 11],  // amber-500
    label: "Connect Start → Task via port drag",
  },
  {
    name: "property-grid.png",
    bg: [30, 41, 59],
    bar: [139, 92, 246],  // violet-500
    label: "Property Grid — Task node fields",
  },
  {
    name: "save-workflow.png",
    bg: [30, 41, 59],
    bar: [236, 72, 153],  // pink-500
    label: "Save workflow — toolbar + toast",
  },
  {
    name: "run-workflow.png",
    bg: [30, 41, 59],
    bar: [239, 68, 68],   // red-500
    label: "Run workflow — execution in progress",
  },
];

// ── Generate ──
mkdirSync(OUT_DIR, { recursive: true });
for (const s of screenshots) {
  const png = createPng(s.bg, s.bar, s.label);
  const path = resolve(OUT_DIR, s.name);
  writeFileSync(path, png);
  console.log(`✓ ${s.name}  (${png.length} bytes)`);
}
console.log(`\nDone — ${screenshots.length} screenshots in ${OUT_DIR}`);
