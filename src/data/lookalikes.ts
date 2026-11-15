export interface LookalikeGroup {
  kana: string[]
  hint: string
}

// Visually confusable kana. Used for distractors, error hints and pattern detection.
export const LOOKALIKES: LookalikeGroup[] = [
  // hiragana
  { kana: ['ぬ', 'め'],      hint: 'ぬ ends in a loop, め does not' },
  { kana: ['ね', 'れ', 'わ'], hint: 'ね loops at the bottom, れ kicks out to the right, わ curls inward' },
  { kana: ['は', 'ほ', 'ま'], hint: 'は has one bar, ほ has two, ま has no vertical stroke on the left' },
  { kana: ['さ', 'き', 'ち'], hint: 'き has two bars, さ one; ち has the bar on top and curves like a 5' },
  { kana: ['る', 'ろ'],      hint: 'る ends in a loop, ろ does not' },
  { kana: ['あ', 'お'],      hint: 'お has a small tick on the right, あ has none' },
  { kana: ['い', 'り'],      hint: 'り is taller and its right stroke is long; い has two short strokes' },
  { kana: ['こ', 'に'],      hint: 'に has an extra vertical stroke on the left' },
  { kana: ['た', 'な'],      hint: 'た has a こ shape on the right, な has a loop at the bottom' },
  { kana: ['け', 'は'],      hint: 'は has a loop at the bottom, け does not' },
  { kana: ['う', 'ら'],      hint: 'ら has a hooked stroke under the dot, う a single curve' },
  { kana: ['ふ', 'ぷ', 'ぶ'], hint: 'same base; ぶ has two dots, ぷ a circle' },
  // katakana
  { kana: ['シ', 'ツ'],      hint: 'シ: short strokes lean flat, long stroke sweeps up from the bottom. ツ: short strokes stand up, long stroke comes down from the top' },
  { kana: ['ン', 'ソ'],      hint: 'ン sweeps up from the bottom, ソ comes down from the top' },
  { kana: ['ク', 'ケ', 'タ'], hint: 'タ is ク with an extra stroke inside, ケ has a bar sticking out' },
  { kana: ['ワ', 'フ', 'ウ'], hint: 'ウ has a tick on top, ワ has a vertical stroke on the left, フ has neither' },
  { kana: ['コ', 'ユ'],      hint: 'ユ\'s bottom stroke sticks out to the right' },
  { kana: ['ナ', 'メ'],      hint: 'ナ is a cross with a long sweep, メ is two crossing diagonals' },
  { kana: ['ヌ', 'ス'],      hint: 'ヌ has a short extra stroke across the sweep, ス does not' },
  { kana: ['チ', 'テ'],      hint: 'テ has two bars, チ has one' },
  { kana: ['ア', 'マ'],      hint: 'マ is one bent top stroke, ア has a hook on the right' },
  { kana: ['ル', 'レ'],      hint: 'ル has two strokes, レ only one' },
  { kana: ['ロ', 'コ'],      hint: 'ロ is closed on the left, コ is open' },
  { kana: ['ヲ', 'ラ'],      hint: 'ヲ has two full bars, ラ only a short one on top' },
  { kana: ['オ', 'ホ'],      hint: 'ホ has two extra dots at the bottom' },
]

export function lookalikesOf(kana: string): string[] {
  const group = LOOKALIKES.find(g => g.kana.includes(kana))
  return group ? group.kana.filter(k => k !== kana) : []
}

export function lookalikeHint(a: string, b: string): string | null {
  const group = LOOKALIKES.find(g => g.kana.includes(a) && g.kana.includes(b))
  return group?.hint ?? null
}
