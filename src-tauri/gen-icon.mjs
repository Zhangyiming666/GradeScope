/* global Buffer, console, process */

// Generates a 1024x1024 RGBA PNG app icon for GradeScope.
// Theme: rounded-square indigo tile with a 3-bar ascending "grades" chart + check.
// No external deps — manual PNG encoding via zlib.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const SIZE = 1024
const buf = Buffer.alloc(SIZE * SIZE * 4) // RGBA

function set(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  const i = (y * SIZE + x) * 4
  // alpha over existing
  const dstA = buf[i + 3] / 255
  const srcA = a / 255
  const outA = srcA + dstA * (1 - srcA)
  if (outA === 0) { buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0; return }
  buf[i] = Math.round((r * srcA + buf[i] * dstA * (1 - srcA)) / outA)
  buf[i + 1] = Math.round((g * srcA + buf[i + 1] * dstA * (1 - srcA)) / outA)
  buf[i + 2] = Math.round((b * srcA + buf[i + 2] * dstA * (1 - srcA)) / outA)
  buf[i + 3] = Math.round(outA * 255)
}

function inRoundedRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy <= r * r
}

// Background: vertical indigo gradient inside a rounded square.
const top = [99, 102, 241]    // indigo-500
const bot = [79, 70, 229]     // indigo-600
const margin = 64
const radius = 200
for (let y = 0; y < SIZE; y++) {
  const t = y / (SIZE - 1)
  const r = Math.round(top[0] + (bot[0] - top[0]) * t)
  const g = Math.round(top[1] + (bot[1] - top[1]) * t)
  const b = Math.round(top[2] + (bot[2] - top[2]) * t)
  for (let x = 0; x < SIZE; x++) {
    if (inRoundedRect(x, y, margin, margin, SIZE - margin, SIZE - margin, radius)) {
      set(x, y, r, g, b, 255)
    }
  }
}

// Three ascending bars (white, semi-rounded) — a grade/score motif.
function fillRoundedRect(x0, y0, x1, y1, r, col, a) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (inRoundedRect(x, y, x0, y0, x1, y1, r)) set(x, y, col[0], col[1], col[2], a)
    }
  }
}

const white = [255, 255, 255]
const baseY = 720
const barW = 150
const gap = 70
const startX = (SIZE - (barW * 3 + gap * 2)) / 2
const heights = [200, 320, 440]
for (let i = 0; i < 3; i++) {
  const x0 = Math.round(startX + i * (barW + gap))
  const x1 = x0 + barW
  const y0 = baseY - heights[i]
  fillRoundedRect(x0, y0, x1, baseY, 40, white, i === 2 ? 255 : 220)
}

// PNG encode
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = crc32(Buffer.concat([typeBuf, data]))
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(b) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8   // bit depth
ihdr[9] = 6   // color type RGBA
ihdr[10] = 0
ihdr[11] = 0
ihdr[12] = 0

// add filter byte (0) per scanline
const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE)
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0
  buf.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
}
const idat = deflateSync(raw, { level: 9 })

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
])

writeFileSync(process.argv[2] || 'app-icon.png', png)
console.log('wrote', process.argv[2] || 'app-icon.png', png.length, 'bytes')
