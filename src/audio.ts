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

// Blob URLs bypass the service worker entirely, avoiding the iOS Safari issue
// where the SW returns a full 200 to a Range request and Safari refuses to play.
const blobUrls = new Map<string, string>()

// Track the current audio so rapid clicks stop the previous sound.
let current: HTMLAudioElement | null = null

export function playKana(kana: string): void {
  const url = audioUrl(toHiragana(kana))
  const src = blobUrls.get(url) ?? url
  console.log('[audio] play', kana, blobUrls.has(url) ? '(blob)' : '(raw url)')
  current?.pause()
  current = new Audio(src)
  current.play().catch(e => console.error('[audio] play failed:', e))
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
      .catch(e => console.warn('[audio] precache failed:', h, e))
  }
}
