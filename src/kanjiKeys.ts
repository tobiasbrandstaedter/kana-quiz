// storage keys of the kanji part. Kept out of its lazy chunk: backup and reset need them
// without loading the kanji data.
export const KANJI_STATS_KEY = 'kanji_stats_v1'
// what a reset wipes, the prefs stay like the kana prefs do
export const KANJI_PROGRESS_KEYS = [KANJI_STATS_KEY, 'kanji_answers_v1']
export const KANJI_KEYS = [...KANJI_PROGRESS_KEYS, 'kanji_prefs']
