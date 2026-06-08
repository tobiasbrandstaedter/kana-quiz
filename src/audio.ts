let voice: SpeechSynthesisVoice | null = null

function findVoice(): void {
  const voices = window.speechSynthesis.getVoices()
  // prefer a local (offline) Japanese voice, fall back to any Japanese voice
  voice = voices.find(v => v.lang.startsWith('ja') && v.localService)
        ?? voices.find(v => v.lang.startsWith('ja'))
        ?? null
}

if ('speechSynthesis' in window) {
  findVoice()
  // Chrome loads voices async; Safari/Firefox have them immediately
  window.speechSynthesis.addEventListener('voiceschanged', findVoice)
}

export function playKana(kana: string): void {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(kana)
  u.lang = 'ja-JP'
  u.rate = 0.8
  if (voice) u.voice = voice
  window.speechSynthesis.speak(u)
}
