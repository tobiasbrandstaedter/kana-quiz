import { allPairs } from './data/kana'

const BASE = 'https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana'

function toHiragana(kana: string): string {
  return kana.replace(/[ァ-ヶ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  )
}

function audioUrl(hiragana: string): string {
  return `${BASE}/${hiragana}_v2.mp3`
}

// One element reused for every play. iOS Safari activates an HTMLAudioElement
// on the first user-gesture play and keeps it activated — creating a new element
// per tap forces iOS to re-evaluate the gesture each time, causing inconsistent
// failures. A single element sidesteps that entirely.
const player = new Audio()

export function playKana(kana: string): void {
  player.pause()
  player.src = audioUrl(toHiragana(kana))
  player.currentTime = 0
  player.play().catch(() => {})
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
