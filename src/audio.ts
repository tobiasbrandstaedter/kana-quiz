import { ref } from 'vue'

const BASE = 'https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana'

function toHiragana(kana: string): string {
  return kana.replace(/[ァ-ヶ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  )
}

function audioUrl(hiragana: string): string {
  return `${BASE}/${hiragana}_v2.mp3`
}

export const playing = ref(false)

let current: HTMLAudioElement | null = null

export function playKana(kana: string): void {
  const url = audioUrl(toHiragana(kana))
  console.log('[audio] play', kana, url)
  current?.pause()
  current = new Audio(url)
  playing.value = true
  current.addEventListener('ended', () => { playing.value = false })
  current.addEventListener('pause', () => { playing.value = false })
  current.play().catch(e => {
    console.error('[audio] play failed:', e)
    playing.value = false
  })
}
