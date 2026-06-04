# Kana Quiz

A practice quiz for hiragana and katakana. Built with Vite, Vue 3, and TypeScript. Runs entirely client-side; progress persists in `localStorage`.

## Requirements

- Node.js 18+ (20+ recommended)
- pnpm

## Setup

```sh
pnpm install
```

## Development

```sh
pnpm dev
```

Vite starts a dev server at `http://localhost:5173`.

## Build

```sh
node_modules/.bin/vite build
```

Output goes to `dist/`. The folder is fully static and can be hosted anywhere (GitHub Pages, Netlify, nginx, etc.).

```sh
pnpm preview    # preview the production build locally
pnpm type-check # run vue-tsc --noEmit
```

> `pnpm build` is currently broken by a pnpm 11 / esbuild build-scripts approval issue. Use the `vite` binary directly as shown above.

## Features

- Hiragana, katakana, or both — selectable per session
- Three kana groups: main (清音), dakuten/handakuten (濁音・半濁音), combination kana (拗音)
- Two quiz directions: kana → romaji (type answer) and romaji → kana (multiple choice)
- Mixed mode alternates directions randomly
- Configurable question count; repeats pool to fill if count exceeds unique kana
- Error tracker: wrong answers accumulate across sessions; dedicated "practice errors" mode weights by error count
- Per-kana statistics: accuracy, total seen, average response time
- Five kana font options (Noto Sans JP, Noto Serif JP, M PLUS Rounded 1c, Kosugi Maru, BIZ UDGothic)
- All preferences (script, columns, mode, font, question count) saved to `localStorage`

## Project structure

```
src/
├── types.ts                  shared interfaces and union types
├── main.ts                   app entry point
├── styles.css                all styles
├── data/kana.ts              HIRAGANA / KATAKANA tables, allPairs()
├── composables/
│   ├── useStats.ts           localStorage stats, error tracking, recordAnswer
│   ├── useSetup.ts           script / column / mode / font / count state
│   ├── useSession.ts         active quiz session state and logic
│   └── useQuiz.ts            orchestrator; exports QUIZ_KEY and QuizContext
└── components/
    ├── SetupScreen.vue       header, font picker, tab navigation
    ├── QuizScreen.vue        question card, input, feedback
    ├── ResultsScreen.vue     score, missed pairs, action buttons
    ├── ColumnSelector.vue    kana column grid (props/emits)
    ├── ErrorsTab.vue         error list and practice button
    └── StatsTab.vue          summary cards, filter buttons, stats table
```