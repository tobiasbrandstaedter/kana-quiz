// storage keys and item ids of the kanji part. Kept out of its lazy chunk: backup, reset and
// the shell need them without loading the kanji data.
export const KANJI_STATS_KEY = 'kanji_stats_v1'
export const KANJI_ANSWERS_KEY = 'kanji_answers_v1'
export const KANJI_PREFS_KEY = 'kanji_prefs'
// what a reset wipes, the prefs stay like the kana prefs do
export const KANJI_PROGRESS_KEYS = [KANJI_STATS_KEY, KANJI_ANSWERS_KEY]
export const KANJI_KEYS = [...KANJI_PROGRESS_KEYS, KANJI_PREFS_KEY]

// a kanji item is `k:日`, a word `w:...` (see wordId in data/kanjiData.ts)
export const kanjiId = (kanji: string) => `k:${kanji}`

/** The kanji of a kanji item id, null for a word or anything else. */
export const kanjiOfId = (id: string): string | null => id.startsWith('k:') ? id.slice(2) : null

// the table card of a group that opens in a session is `g:<group id>`: shown, never an item, nothing stored
export const groupCardId = (group: string) => `g:${group}`
export const cardGroup = (id: string): string | null => id.startsWith('g:') ? id.slice(2) : null
