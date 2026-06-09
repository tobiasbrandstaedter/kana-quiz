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

// Single element reused for every play so iOS Safari's activation persists.
const player = new Audio()

// Blob URLs created from cached audio data. iOS Safari sends Range requests
// for audio loaded via http(s) URLs, and the service worker returns a full 200
// instead of 206, which Safari refuses to play. Blob URLs load from memory and
// skip the service worker entirely, so no Range requests are issued.
const blobUrls = new Map<string, string>()

export function playKana(kana: string): void {
  const url = audioUrl(toHiragana(kana))
  player.pause()
  player.src = blobUrls.get(url) ?? url
  player.play().catch(() => {})
}

export function precacheKanaAudio(): void {
  const seen = new Set<string>()
  for (const { kana } of allPairs()) {
    const h = toHiragana(kana)
    if (seen.has(h)) continue
    seen.add(h)
    const url = audioUrl(h)
    fetch(url)
      .then(r => r.blob())
      .then(blob => { blobUrls.set(url, URL.createObjectURL(blob)) })
      .catch(() => {})
  }
}
