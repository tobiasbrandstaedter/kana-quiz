// The kana fonts of the picker. Only the default one is in index.html: Japanese fonts
// come as about a hundred slices each, and the stylesheet for all six was the largest
// file the app loaded. The others are fetched when they are needed.
export const KANA_FONTS = [
  { family: 'Zen Maru Gothic',   label: 'Maru' },
  { family: 'Noto Sans JP',      label: 'Sans' },
  { family: 'Noto Serif JP',     label: 'Serif' },
  { family: 'M PLUS Rounded 1c', label: 'Round' },
  { family: 'Kosugi Maru',       label: 'Soft' },
  { family: 'BIZ UDGothic',      label: 'Gothic' },
]

// kana are always drawn bold, Kosugi Maru only exists in regular
const REGULAR_ONLY = new Set(['Kosugi Maru'])
const loaded = new Set(['Zen Maru Gothic'])

export function loadKanaFont(family: string): void {
  if (loaded.has(family) || !KANA_FONTS.some(f => f.family === family)) return
  loaded.add(family)
  const spec = family.replace(/ /g, '+') + (REGULAR_ONLY.has(family) ? '' : ':wght@700')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`
  document.head.appendChild(link)
}
