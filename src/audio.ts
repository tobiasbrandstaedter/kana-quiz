import { katakanaToHiragana } from './data/kana'

const BASE = 'https://files.tofugu.com/articles/japanese/2014-06-30-learn-hiragana'

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

/** Whether the browser has a system voice at all, the button that speaks a word shows only then. */
export const canSpeak = 'speechSynthesis' in window

const japaneseVoice = () => speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('ja'))

// the clips come from another host and can't be cached (no CORS), so offline
// the system voice has to do
function speak(kana: string): boolean {
  if (!canSpeak) return false
  // without a Japanese voice the browser reads kana in silence or as gibberish,
  // better to report it so the card can say that there is no sound
  if (!japaneseVoice()) return false
  const u = new SpeechSynthesisUtterance(kana)
  u.lang = 'ja-JP'
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
  return true
}

// browsers load the voice list lazily, asking once at start has it ready for the fallback
if (canSpeak) speechSynthesis.getVoices()

/**
 * Speaks a reading (hiragana) with the Japanese system voice, for words, which have no clips.
 * Unlike `speak` above this doesn't ask getVoices() first: since iOS 16 the Japanese voice
 * can be missing from that list and still speak (KD13). Call it from a tap only.
 */
export function speakReading(kana: string): void {
  const u = new SpeechSynthesisUtterance(kana)
  u.lang = 'ja-JP'
  // where the list does have a Japanese voice, naming it keeps a browser from reading
  // with its default voice
  const voice = japaneseVoice()
  if (voice) u.voice = voice
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

/**
 * `blocked`: the browser refused to play, which on iOS means a tap is needed first.
 * `none`: there is no sound to be had right now (offline and no Japanese voice).
 */
export type PlayResult = 'played' | 'blocked' | 'none'

export async function playKana(kana: string): Promise<PlayResult> {
  unlocked = true
  player.pause()
  player.src = audioUrl(katakanaToHiragana(kana))
  try {
    await player.play()
    return 'played'
  } catch (e) {
    const name = (e as DOMException).name
    if (name === 'NotAllowedError') return 'blocked'
    // a newer play() call took over, nothing went wrong
    if (name === 'AbortError') return 'played'
    return speak(kana) ? 'played' : 'none'
  }
}
