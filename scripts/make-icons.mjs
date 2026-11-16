// Draws the app icon: あ in its KanjiVG strokes, white with a hard ink shadow on the
// primary purple. Writes public/icon.svg plus the PNG sizes the manifest and iOS want.
// No dependencies, the PNGs are rasterized here. Run: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// あ from KanjiVG (CC BY-SA 3.0, Ulrich Apel), same data as src/data/strokes.ts
const STROKES = [
  'M31.01,33c0.88,0.88,2.75,1.82,5.25,1.75c8.62-0.25,20-2.12,29.5-4.25c1.51-0.34,4.62-0.88,6.62-0.5',
  'M49.76,17.62c0.88,1,1.82,3.26,1.38,5.25c-3.75,16.75-6.25,38.13-5.13,53.63c0.41,5.7,1.88,10.88,3.38,13.62',
  'M65.63,44.12c0.75,1.12,1.16,4.39,0.5,6.12c-4.62,12.26-11.24,23.76-25.37,35.76c-6.86,5.83-15.88,3.75-16.25-8.38c-0.34-10.87,13.38-23.12,32.38-26.74c12.42-2.37,27,1.38,30.5,12.75c4.05,13.18-3.76,26.37-20.88,30.49',
]
const BOX = 109        // KanjiVG viewBox
const GLYPH = 0.82     // share of the icon the 109 box takes, keeps the kana inside a maskable safe zone
const WIDTH = 10       // stroke width in KanjiVG units
const SHADOW = 4.5     // shadow offset in KanjiVG units
const BG = [0x5b, 0x4b, 0xdb]
const INK = [0x1b, 0x1b, 0x2f]
const FRONT = [0xff, 0xff, 0xff]

// the paths only use M and relative c, so that is all this reads
function toSegments(d) {
  const out = []
  const nums = d.match(/-?\d*\.?\d+/g).map(Number)
  let [x, y] = nums
  for (let i = 2; i + 5 < nums.length; i += 6) {
    const p = [[x, y], [x + nums[i], y + nums[i + 1]], [x + nums[i + 2], y + nums[i + 3]], [x + nums[i + 4], y + nums[i + 5]]]
    let prev = p[0]
    for (let s = 1; s <= 16; s++) {
      const t = s / 16
      const u = 1 - t
      const at = k => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]
      const next = [at(0), at(1)]
      out.push([prev[0], prev[1], next[0], next[1]])
      prev = next
    }
    ;[x, y] = p[3]
  }
  return out
}

const SEGMENTS = STROKES.flatMap(toSegments)

function distance(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax
  const dy = by - ay
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(px - ax - t * dx, py - ay - t * dy)
}

// how much of the pixel a round stroke covers, in KanjiVG units
function coverage(x, y, pixel) {
  let d = Infinity
  for (const s of SEGMENTS) d = Math.min(d, distance(x, y, s))
  return Math.max(0, Math.min(1, (WIDTH / 2 - d) / pixel + 0.5))
}

function render(size) {
  const pixel = BOX / (size * GLYPH)          // one pixel in KanjiVG units
  const origin = (size - size * GLYPH) / 2
  const rgba = Buffer.alloc(size * size * 4)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - origin) * pixel
      const y = (py + 0.5 - origin) * pixel
      const shadow = coverage(x - SHADOW, y - SHADOW, pixel)
      const front = coverage(x, y, pixel)
      const i = (py * size + px) * 4
      for (let c = 0; c < 3; c++) {
        const under = BG[c] + (INK[c] - BG[c]) * shadow
        rgba[i + c] = Math.round(under + (FRONT[c] - under) * front)
      }
      rgba[i + 3] = 255
    }
  }
  return rgba
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const b of body) crc = CRC[(crc ^ b) & 0xff] ^ (crc >>> 8)
  const out = Buffer.alloc(body.length + 8)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4)
  return out
}

function png(size) {
  const rgba = render(size)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8)  // 8 bit RGBA
  // every row starts with filter type 0
  const rows = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

function svg() {
  const hex = c => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`
  const scale = (512 * GLYPH) / BOX
  const origin = (512 - 512 * GLYPH) / 2
  const paths = STROKES.map(d => `<path d="${d}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${hex(BG)}"/>
  <g transform="translate(${origin} ${origin}) scale(${scale.toFixed(4)})" fill="none" stroke-width="${WIDTH}" stroke-linecap="round" stroke-linejoin="round">
    <g transform="translate(${SHADOW} ${SHADOW})" stroke="${hex(INK)}">${paths}</g>
    <g stroke="${hex(FRONT)}">${paths}</g>
  </g>
</svg>
`
}

const out = new URL('../public/', import.meta.url)
writeFileSync(new URL('icon.svg', out), svg())
for (const [name, size] of [['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  writeFileSync(new URL(name, out), png(size))
  console.log(`${name} ${size}x${size}`)
}
