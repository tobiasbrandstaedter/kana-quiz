# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
pnpm install                    # install deps
pnpm dev                        # dev server at http://localhost:5173
node_modules/.bin/vite build    # production build (use this directly; pnpm build is broken by an esbuild pnpm 11 issue)
pnpm type-check                 # vue-tsc --noEmit for type checking
pnpm preview                    # serve the dist/ build locally
```

There is no test suite and no linter configured.

## Architecture

Vite + Vue 3 + TypeScript SPA. All shared types live in `src/types.ts`. Kana data is in `src/data/kana.ts`.

### Composables (`src/composables/`)

Responsibilities are split across three composables and one orchestrator:

- **`useStats.ts`** — `statsData` ref (mirrors `localStorage`), computed `errorPairs`/`errorKanaSet`, `recordAnswer`, `removeErrorEntry`, `confirmClearErrors/Stats`
- **`useSetup.ts`** — setup screen state: `activeScript`, `selectedCols` (a `Set<string>` ref), `quizMode`, font, count input; computed `selectorScripts`, `countHint`, `headerTitle`; all selection/mode/font setters; `init()` to restore from localStorage
- **`useSession.ts`** — active quiz session: `questions`, `current`, `answered`, `typedAnswer`, `feedbackType`, `typeFieldEl` (template ref); `start()`, `submitTyped(recordFn)`, `selectAnswer(chosen, recordFn)`, `next(onResults)` — the record callbacks are injected from outside so the session doesn't depend on stats directly
- **`useQuiz.ts`** — orchestrator: calls the three composables, wires up `submitTyped`/`selectAnswer` to `stats.recordAnswer`, adds `statsSummary` and `filteredStatsRows` computeds, exports `QUIZ_KEY` (InjectionKey) and `QuizContext` type

`App.vue` calls `useQuiz()` once and `provide(QUIZ_KEY, quiz)`. All screen/tab components `inject(QUIZ_KEY)` to access the context.

### Components (`src/components/`)

- **`SetupScreen.vue`** — header, font switcher, tab nav; renders `PracticeTab` content inline + `ErrorsTab` and `StatsTab` sub-components
- **`QuizScreen.vue`** — progress bar, question card, type input or choice buttons, feedback, next button
- **`ResultsScreen.vue`** — score, missed pairs grid, action buttons
- **`ColumnSelector.vue`** — prop-based (`selectorScripts`, `selectedCols`, `errorKanaSet`), emits `toggle/selectAll/selectNone/selectGroup`; the only component that doesn't inject the quiz context
- **`ErrorsTab.vue`** — error tracker list, injects quiz context
- **`StatsTab.vue`** — stats summary cards + filter buttons + table, injects quiz context

`hiragana-quiz_2.html` is the original single-file version kept for reference. Do not modify it.
