import { allPairs } from './data/kana'

const BASE = 'https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana'

// katakana codepoints are exactly 0x60 above their hiragana equivalents
function toHiragana(kana: string): string {
  return kana.replace(/[ァ-ヶ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  )
}

// Use literal kana in the URL string; the browser percent-encodes non-ASCII
// characters when making the HTTP request, which is what the CDN expects.
function audioUrl(hiragana: string): string {
  return `${BASE}/${hiragana}_v2.mp3`
}

// iOS PWA (standalone mode) blocks HTMLAudioElement until the AudioContext
// has been started inside a user gesture. Playing a silent 1-sample buffer
// on first tap unlocks audio for the entire page session.
let unlocked = false

function ensureUnlocked(): void {
  if (unlocked) return
  unlocked = true
  try {
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as any).webkitAudioContext
    const ctx = new Ctor()
    const buf = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    src.start(0)
    ctx.resume().catch(() => {})
  } catch {}
}

export function playKana(kana: string): void {
  ensureUnlocked() // synchronous — must stay in the user-gesture call stack
  const audio = new Audio(audioUrl(toHiragana(kana)))
  audio.play().catch(() => {})
}

export function precacheKanaAudio(): void {
  const seen = new Set<string>()
  for (const { kana } of allPairs()) {
    const h = toHiragana(kana)
    if (seen.has(h)) continue
    seen.add(h)
    fetch(audioUrl(h)).catch(() => {})
  }
}
