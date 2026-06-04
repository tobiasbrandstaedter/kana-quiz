import { ref, computed, watch } from 'vue'
import type { ActiveScript, QuizMode, KanaPair, KanaData, ScriptName } from '../types'
import { HIRAGANA, KATAKANA } from '../data/kana'

const LS_FONT   = 'hiragana_kana_font'
const LS_SCRIPT = 'kana_script'
const LS_PREFS  = 'kana_prefs'

interface Prefs {
  cols?: string[]
  mode?: QuizMode
  questionCount?: string
}

function loadPrefs(): Prefs {
  try { return JSON.parse(localStorage.getItem(LS_PREFS) ?? '{}') } catch { return {} }
}

function savePrefs(patch: Partial<Prefs>): void {
  try {
    const prefs = loadPrefs()
    Object.assign(prefs, patch)
    localStorage.setItem(LS_PREFS, JSON.stringify(prefs))
  } catch {}
}

export function useSetup() {
  const activeScript = ref<ActiveScript>('hiragana')
  const selectedCols = ref<Set<string>>(new Set())
  const quizMode = ref<QuizMode>('kana-to-romaji')
  const questionCountInput = ref('')
  const kanaFont = ref('Noto Sans JP')

  const selectorScripts = computed((): Array<[ScriptName, KanaData]> =>
    activeScript.value === 'both'
      ? [['hiragana', HIRAGANA], ['katakana', KATAKANA]]
      : [[activeScript.value === 'katakana' ? 'katakana' : 'hiragana', activeScript.value === 'katakana' ? KATAKANA : HIRAGANA]]
  )

  const selectedCount = computed(() => selectedCols.value.size)

  const headerTitle = computed(() =>
    ({ hiragana: 'ひらがな', katakana: 'カタカナ', both: 'かなカナ' } satisfies Record<ActiveScript, string>)[activeScript.value]
  )

  function buildPairsFromSelected(): KanaPair[] {
    const pairs: KanaPair[] = []
    for (const [scriptName, columns] of selectorScripts.value)
      for (const cols of Object.values(columns))
        for (const col of cols) {
          if (!selectedCols.value.has(col.id)) continue
          col.kana.forEach((k, i) => pairs.push({ kana: k, romaji: col.romaji[i], script: scriptName as ScriptName }))
        }
    return pairs
  }

  const countHint = computed(() => {
    const pool = buildPairsFromSelected()
    const val = questionCountInput.value.trim()
    if (!val) return pool.length > 0 ? `Blank = all ${pool.length} kana from selection` : 'Leave blank to use all selected kana'
    const n = parseInt(val)
    if (!isNaN(n) && pool.length > 0 && n > pool.length) return `${pool.length} unique kana — will repeat to fill ${n} questions`
    return `${n} question${n !== 1 ? 's' : ''} per session`
  })

  watch(questionCountInput, val => savePrefs({ questionCount: val.trim() }))

  function setKanaFont(family: string): void {
    kanaFont.value = family
    document.documentElement.style.setProperty('--kana-font', `'${family}', sans-serif`)
    try { localStorage.setItem(LS_FONT, family) } catch {}
  }

  function setScript(script: ActiveScript): void {
    activeScript.value = script
    const prefs = loadPrefs()
    selectedCols.value = prefs.cols?.length ? new Set(prefs.cols) : new Set()
    try { localStorage.setItem(LS_SCRIPT, script) } catch {}
  }

  function toggleCol(id: string): void {
    const next = new Set(selectedCols.value)
    next.has(id) ? next.delete(id) : next.add(id)
    selectedCols.value = next
    savePrefs({ cols: [...next] })
  }

  function selectAll(): void {
    const next = new Set<string>()
    for (const [, columns] of selectorScripts.value)
      for (const cols of Object.values(columns))
        for (const col of cols) next.add(col.id)
    selectedCols.value = next
    savePrefs({ cols: [...next] })
  }

  function selectNone(): void {
    selectedCols.value = new Set()
    savePrefs({ cols: [] })
  }

  function selectGroup(group: string): void {
    const next = new Set(selectedCols.value)
    for (const [, columns] of selectorScripts.value) {
      const cols = (columns as Record<string, typeof HIRAGANA.main>)[group] ?? []
      for (const col of cols) next.add(col.id)
    }
    selectedCols.value = next
    savePrefs({ cols: [...next] })
  }

  function setMode(mode: QuizMode): void {
    quizMode.value = mode
    savePrefs({ mode })
  }

  function init(): void {
    try {
      const saved = localStorage.getItem(LS_SCRIPT) as ActiveScript | null
      if (saved) activeScript.value = saved
    } catch {}

    const prefs = loadPrefs()
    if (prefs.cols?.length) selectedCols.value = new Set(prefs.cols)
    if (prefs.mode) quizMode.value = prefs.mode
    if (prefs.questionCount) questionCountInput.value = prefs.questionCount

    try {
      const savedFont = localStorage.getItem(LS_FONT)
      if (savedFont) {
        kanaFont.value = savedFont
        document.documentElement.style.setProperty('--kana-font', `'${savedFont}', sans-serif`)
      }
    } catch {}
  }

  return {
    activeScript, selectedCols, quizMode, questionCountInput, kanaFont,
    selectorScripts, selectedCount, countHint, headerTitle,
    buildPairsFromSelected,
    setKanaFont, setScript, toggleCol, selectAll, selectNone, selectGroup, setMode,
    init,
  }
}
