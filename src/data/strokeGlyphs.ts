import { STROKES } from './strokes'

// One stroke placed in a row of glyphs. A combo like きゃ is the base kana plus the
// small ya/yu/yo next to it, drawn one after the other.
export interface PlacedStroke {
  d: string
  dx: number                // x offset of the glyph this stroke belongs to
  number: [number, number]  // stroke number position, inside its own glyph
}

export interface KanaStrokes {
  width: number  // viewBox width, the height is always 109
  strokes: PlacedStroke[]
}

const CELL = 109
// KanjiVG keeps a full cell around the small kana; this pulls it in next to the base kana
const NEXT_GLYPH_DX = 75

const cache = new Map<string, KanaStrokes | null>()

/** null when any glyph of the kana has no stroke data. */
export function kanaStrokes(kana: string): KanaStrokes | null {
  if (cache.has(kana)) return cache.get(kana)!
  const strokes: PlacedStroke[] = []
  const glyphs = [...kana]
  let found = glyphs.length > 0
  glyphs.forEach((g, n) => {
    const data = STROKES[g]
    if (!data) { found = false; return }
    data.paths.forEach((d, i) => strokes.push({ d, dx: n * NEXT_GLYPH_DX, number: data.numbers[i] }))
  })
  const out = found ? { width: CELL + (glyphs.length - 1) * NEXT_GLYPH_DX, strokes } : null
  cache.set(kana, out)
  return out
}
