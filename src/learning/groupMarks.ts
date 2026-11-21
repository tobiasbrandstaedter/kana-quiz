// The irregular mark of a group member (KR74). scripts/extract-kanji.mjs computes it with
// this module, so it imports nothing and keeps to type annotations node can strip.

const isKana = (ch: string) => /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(ch)
const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))

/** The number of a member: what comes before the counter, or the leading kanji when the counter isn't in the form. */
export function numberPart(form: string, counter: string): string {
  const at = counter ? form.indexOf(counter) : -1
  return at > 0 ? form.slice(0, at) : form.match(/^\p{Script=Han}+/u)?.[0] ?? ''
}

/**
 * Regular means the number read the way its kanji read as words of their own (`ownReading`),
 * followed by one of `tailReadings` of the rest (a kana tail is read as it is). Null when a
 * kanji of the number has no word of its own in the course yet.
 */
export function isIrregular(
  form: string, reading: string, counter: string,
  ownReading: Map<string, string>, tailReadings: (tail: string) => string[],
): boolean | null {
  const head = numberPart(form, counter)
  if ([...head].some(ch => !ownReading.has(ch))) return null
  const h = [...head].map(ch => ownReading.get(ch)).join('')
  const tail = form.slice(head.length)
  const tails = tail === '' ? [''] : [...tail].every(isKana) ? [toHira(tail)] : tailReadings(tail)
  return !tails.some(t => h + t === reading)
}
