const BASE = 'https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana'

// katakana codepoints are exactly 0x60 above their hiragana equivalents
function toHiragana(kana: string): string {
  return kana.replace(/[ァ-ヶ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  )
}

export function playKana(kana: string): void {
  const encoded = encodeURIComponent(toHiragana(kana))
  const audio = new Audio(`${BASE}/${encoded}_v2.mp3`)
  audio.play().catch(() => {
    new Audio(`${BASE}/${encoded}_v2.ogg`).play().catch(() => {})
  })
}
