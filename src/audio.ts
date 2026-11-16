const BASE = 'https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana'

function toHiragana(kana: string): string {
  return kana.replace(/[ァ-ヶ]/g, c =>
    String.fromCharCode(c.charCodeAt(0) - 0x60)
  )
}

function audioUrl(hiragana: string): string {
  return `${BASE}/${hiragana}_v2.mp3`
}

// iOS only lets a media element play without a tap once it has played from one.
// So there is a single element for the whole app, unlocked on the first tap,
// which also lets listen mode start the sound after an automatic advance.
const player = new Audio()
const SILENCE = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
let unlocked = false

export function unlockAudio(): void {
  if (unlocked) return
  unlocked = true
  player.src = SILENCE
  player.play().then(() => player.pause()).catch(() => {})
}

// the clips come from another host and can't be cached (no CORS), so offline
// the system voice has to do
function speak(kana: string): boolean {
  if (!('speechSynthesis' in window)) return false
  const u = new SpeechSynthesisUtterance(kana)
  u.lang = 'ja-JP'
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
  return true
}

/** false when the browser refused to play, which on iOS means a tap is needed first. */
export async function playKana(kana: string): Promise<boolean> {
  unlocked = true
  player.pause()
  player.src = audioUrl(toHiragana(kana))
  try {
    await player.play()
    return true
  } catch (e) {
    const name = (e as DOMException).name
    if (name === 'NotAllowedError') return false
    // a newer play() call took over, nothing went wrong
    if (name === 'AbortError') return true
    return speak(kana)
  }
}
