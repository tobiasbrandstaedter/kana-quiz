import { ref, computed, watch } from 'vue'
import type { ActiveScript, QuizMode, KanaPair, KanaData, ScriptName } from '../types'
import { HIRAGANA, KATAKANA } from '../data/kana'

const LS_FONT   = 'hiragana_kana_font'
const LS_SCRIPT = 'kana_script'
const LS_PREFS  = 'kana_prefs'

interface Prefs {
  cols?: string[]
  mode?: QuizMode
  timed?: boolean
  questionCount?: string
  smartSize?: number
  smartNew?: number
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
  const timed = ref(false)
  // smart practice: session length and how many new kana it may bring in
  const smartSize = ref(20)
  const smartNew = ref(5)
  // v-model on a type="number" input hands us a number once the user types, so read it through questionCountText
  const questionCountInput = ref<string | number>('')
  const questionCountText = computed(() => String(questionCountInput.value).trim())
  const kanaFont = ref('Zen Maru Gothic')

  const selectorScripts = computed((): Array<[ScriptName, KanaData]> =>
    activeScript.value === 'both'
      ? [['hiragana', HIRAGANA], ['katakana', KATAKANA]]
      : [[activeScript.value === 'katakana' ? 'katakana' : 'hiragana', activeScript.value === 'katakana' ? KATAKANA : HIRAGANA]]
  )

  // selectedCols keeps the picks of both scripts, only the ones on screen count
  const activeCols = computed(() => selectorScripts.value.flatMap(([, data]) => [...data.main, ...data.dakuten, ...data.combo]))
  const pickedCols = computed(() => activeCols.value.filter(c => selectedCols.value.has(c.id)))
  const selectedCount = computed(() => pickedCols.value.length)

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
    const val = questionCountText.value
    if (!val) return pool.length > 0 ? `Blank = all ${pool.length} kana from selection` : 'Leave blank to use all selected kana'
    const n = parseInt(val)
    if (!isNaN(n) && pool.length > 0 && n > pool.length) return `${pool.length} unique kana, repeated to fill ${n} questions`
    return `${n} question${n !== 1 ? 's' : ''} per session`
  })

  watch(questionCountText, val => savePrefs({ questionCount: val }))

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

  // All and None only touch the script on screen, the other script keeps its picks
  function selectAll(): void {
    const next = new Set(selectedCols.value)
    for (const col of activeCols.value) next.add(col.id)
    selectedCols.value = next
    savePrefs({ cols: [...next] })
  }

  function selectNone(): void {
    const next = new Set(selectedCols.value)
    for (const col of activeCols.value) next.delete(col.id)
    selectedCols.value = next
    savePrefs({ cols: [...next] })
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

  function setSmartSize(n: number): void {
    smartSize.value = n
    savePrefs({ smartSize: n })
  }

  function setSmartNew(n: number): void {
    smartNew.value = n
    savePrefs({ smartNew: n })
  }

  function toggleTimed(): void {
    timed.value = !timed.value
    savePrefs({ timed: timed.value })
  }

  function init(): void {
    try {
      const saved = localStorage.getItem(LS_SCRIPT) as ActiveScript | null
      if (saved) activeScript.value = saved
    } catch {}

    const prefs = loadPrefs()
    if (prefs.cols?.length) selectedCols.value = new Set(prefs.cols)
    if (prefs.mode) quizMode.value = prefs.mode
    if (prefs.timed) timed.value = true
    if (prefs.questionCount) questionCountInput.value = prefs.questionCount
    if (prefs.smartSize) smartSize.value = prefs.smartSize
    if (prefs.smartNew !== undefined) smartNew.value = prefs.smartNew

    try {
      const savedFont = localStorage.getItem(LS_FONT)
      if (savedFont) {
        kanaFont.value = savedFont
        document.documentElement.style.setProperty('--kana-font', `'${savedFont}', sans-serif`)
      }
    } catch {}
  }

  return {
    activeScript, selectedCols, quizMode, timed, smartSize, smartNew, questionCountInput, questionCountText, kanaFont,
    selectorScripts, activeCols, pickedCols, selectedCount, countHint, headerTitle,
    buildPairsFromSelected,
    setKanaFont, setScript, toggleCol, selectAll, selectNone, selectGroup, setMode, toggleTimed, setSmartSize, setSmartNew,
    init,
  }
}
