// One-off script (not part of the build) that generates the placeholder PWA
// icons in public/icons/. Per Milestone 13 scope, these are deliberately
// minimal - a flat brand-colored square with a single letter "R" - and are
// not meant to represent real visual design investment.
//
// Run with: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

// Brand accent (light mode --accent from src/index.css).
const BG = [0x7c, 0x3a, 0xed, 0xff]
const FG = [0xff, 0xff, 0xff, 0xff]

// Standard 5x7 dot-matrix glyph for "R".
// prettier-ignore
const GLYPH_R = [
  '11110',
  '10001',
  '10001',
  '11110',
  '10010',
  '10001',
  '10001',
]

function crc32(buf) {
  let c
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Uint32Array(256)
      for (let n = 0; n < 256; n++) {
        c = n
        for (let k = 0; k < 8; k++) {
          c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        }
        t[n] = c >>> 0
      }
      return t
    })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

/**
 * Renders a size x size RGBA square: solid background, centered letter "R",
 * and (for maskable icons) extra quiet padding so the glyph stays inside the
 * ~80% "safe zone" that OS masks apply.
 */
function renderIcon(size, { maskable = false } = {}) {
  const pixels = new Uint8Array(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = BG[0]
    pixels[i * 4 + 1] = BG[1]
    pixels[i * 4 + 2] = BG[2]
    pixels[i * 4 + 3] = BG[3]
  }

  const glyphCols = GLYPH_R[0].length
  const glyphRows = GLYPH_R.length
  // Maskable icons need the visible glyph within the safe zone (~80% of the
  // canvas, centered), so give them a larger quiet margin.
  const targetFraction = maskable ? 0.42 : 0.6
  const scale = Math.max(1, Math.floor((size * targetFraction) / glyphCols))
  const glyphWidth = glyphCols * scale
  const glyphHeight = glyphRows * scale
  const offsetX = Math.floor((size - glyphWidth) / 2)
  const offsetY = Math.floor((size - glyphHeight) / 2)

  for (let row = 0; row < glyphRows; row++) {
    for (let col = 0; col < glyphCols; col++) {
      if (GLYPH_R[row][col] !== '1') continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = offsetX + col * scale + dx
          const y = offsetY + row * scale + dy
          const idx = (y * size + x) * 4
          pixels[idx] = FG[0]
          pixels[idx + 1] = FG[1]
          pixels[idx + 2] = FG[2]
          pixels[idx + 3] = FG[3]
        }
      }
    }
  }

  // Build raw scanlines with filter-type 0 (none) prefixed on each row.
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0
    pixels
      .subarray(y * stride, (y + 1) * stride)
      .forEach((byte, i) => (raw[y * (stride + 1) + 1 + i] = byte))
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw, { level: 9 })

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]

for (const t of targets) {
  const png = renderIcon(t.size, { maskable: t.maskable })
  writeFileSync(join(outDir, t.name), png)
  console.log(`wrote ${t.name} (${t.size}x${t.size}, ${png.length} bytes)`)
}
