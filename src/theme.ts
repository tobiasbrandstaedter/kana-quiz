// The look of the app. Playground is styles.css as it is, the others set data-theme on <html>
// and styles.css overrides tokens and a few components under that attribute.

export type ThemeId = 'playground' | 'sumi' | 'yoru'

interface Theme {
  id: ThemeId
  label: string
  hint: string
  kanaFont: string            // picked along with the theme, the learner can change it afterwards
  fonts: string | null        // Google Fonts css2 families for the UI, null when index.html has them
  bar: [string, string]       // browser ui color, light and dark, same as --bg
  swatch: [string, string, string]  // ground, ink, accent for the picker
}

export const THEMES: Theme[] = [
  {
    id: 'playground', label: 'Playground', hint: 'bold outlines, hard shadows',
    kanaFont: 'Zen Maru Gothic', fonts: null,
    bar: ['#fffbf2', '#1a1833'], swatch: ['#fffbf2', '#5b4bdb', '#ffc83d'],
  },
  {
    id: 'sumi', label: 'Sumi', hint: 'ink on paper, quiet',
    kanaFont: 'Shippori Mincho', fonts: 'family=Shippori+Mincho:wght@800&family=Zen+Kaku+Gothic+New:wght@500;700',
    bar: ['#f4efe4', '#141311'], swatch: ['#f4efe4', '#1d1b18', '#b8321f'],
  },
  {
    id: 'yoru', label: 'Yoru', hint: 'neon at night',
    kanaFont: 'M PLUS Rounded 1c', fonts: 'family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@600;800&family=Dela+Gothic+One',
    bar: ['#f3f2fa', '#0b0b19'], swatch: ['#0b0b19', '#36e2ff', '#ff3d8b'],
  },
]

export function themeById(id: string | null): Theme {
  return THEMES.find(t => t.id === id) ?? THEMES[0]
}

const loaded = new Set<ThemeId>()

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme.id === 'playground') delete root.dataset.theme
  else root.dataset.theme = theme.id

  if (theme.fonts && !loaded.has(theme.id)) {
    loaded.add(theme.id)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?${theme.fonts}&display=swap`
    document.head.appendChild(link)
  }

  // index.html has one theme-color per color scheme
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
    meta.content = meta.media.includes('dark') ? theme.bar[1] : theme.bar[0]
  })
}
