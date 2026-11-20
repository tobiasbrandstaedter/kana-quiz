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
pnpm test       # run the unit tests (vitest)
```

> `pnpm build` is currently broken by a pnpm 11 / esbuild build-scripts approval issue. Use the `vite` binary directly as shown above.

## Features

- Hiragana, katakana, or both, selectable per session
- Three kana groups: main (清音), dakuten/handakuten (濁音・半濁音), combination kana (拗音)
- Four quiz directions: kana → romaji (type answer), romaji → kana (multiple choice), romaji → write (draw the kana stroke by stroke) and listen → write (the sound plays, the romaji shows only after answering)
- Timed (fluency) option: the limit follows your own pace (3.5 s for typed and 3 s for choice answers until there is enough data), a countdown bar runs above the question. Too slow counts as wrong for the session but doesn't move the kana's review box. Practicing slow kana from the stats or a "Correct but slow" pattern is always timed
- Drawing is checked per stroke for order, direction and rough shape. A wrong stroke shakes and clears with a note on what was off, after two misses the next stroke is hinted, after three the app draws it. A drawing only counts as correct without hints and without order or direction mistakes
- Typed answers accept Kunrei spellings and typing habits (si, tu, hu, nn, ...) next to Hepburn
- Mixed mode picks the direction by how well you know a kana: recognize first, then read, then write
- Configurable question count; repeats pool to fill if count exceeds unique kana
- Smart practice: spaced repetition with Leitner boxes. Due reviews come first, then up to five new kana in table order, each introduced with an intro card before it is tested. New kana are held back while many are still shaky
- Writing tab: watch the animated stroke order (stroke numbers, replay, stroke by stroke view), trace it over a guide, then write it from memory. Covers every hiragana and katakana including combos, which are written as the base kana followed by the small ya, yu or yo. New kana in smart practice are introduced with the same animation
- Missed drawings show up on the results screen as thumbnails, your strokes over the reference
- Stroke patterns: strokes that keep getting redone, and backwards or out of order strokes as a habit across kana
- Progress bar per column in the selector: mastered (green) and learning (purple)
- Error tracker: unresolved errors only, a kana drops out once it is mastered again; "practice errors" weights by recent errors
- Error pattern detection: confusion pairs, weak rows or vowels, dakuten and combo lag, katakana vs hiragana gap, read vs recognize gap, slow but correct, slipping, untested lookalikes. Shown as cards after each round and in the stats tab, each with a one-tap practice session
- Choice questions use targeted distractors: kana you mixed up before, lookalikes, then same row or vowel
- A missed kana comes back a few questions later in the same session
- After a wrong answer the app shows your answer next to the correct kana with a hint on how to tell them apart
- A typo (one letter off, not a real reading) gets one more try, a second one counts as wrong but stays out of the confusion stats
- Per-kana statistics: accuracy, total seen, average response time, per-direction counts, streak, and which wrong answers were given
- Rolling log of the last 1000 answers for trend analysis
- Six kana fonts to pick from (Zen Maru Gothic, Noto Sans JP, Noto Serif JP, M PLUS Rounded 1c, Kosugi Maru, BIZ UDGothic)
- Backup: export the progress as a JSON file and import it again, also on another device
- Installable as a PWA, light and dark theme
- All preferences (script, columns, mode, font, question count) saved to `localStorage`

## Project structure

```
src/
├── types.ts                  shared interfaces and union types
├── main.ts                   app entry point
├── styles.css                all styles
├── format.ts                 fromNow(), stageOf(), accuracy()
├── clock.ts                  the current time as a ref, for everything that depends on it
├── audio.ts                  playKana() with a speech synthesis fallback
├── fonts.ts                  kana fonts of the picker, loaded on demand
├── backup.ts                 export and import of the localStorage keys
├── data/kana.ts              HIRAGANA / KATAKANA tables, allPairs()
├── data/lookalikes.ts        visually confusable kana groups with hints
├── data/strokes.ts           stroke paths from KanjiVG, generated by scripts/extract-strokes.mjs
├── data/strokeGlyphs.ts      kanaStrokes(): strokes of a kana or combo laid out in one row
├── data/kanjiCourse.ts       kanji sets, keywords, picked words, groups, hooks (hand written)
├── data/kanjiSource.ts       readings, meanings, splits per kanji and word, generated by scripts/extract-kanji.mjs
├── data/kanjiStrokes.ts      kanji stroke paths from KanjiVG, generated by the same script
├── data/kanjiData.ts         the one module the app reads kanji content through
├── learning/
│   ├── romaji.ts             accepted romaji spellings, matchesRomaji(), isTypo()
│   ├── statsMigration.ts     normalizeStats(): v2 -> v3 migration
│   ├── patterns.ts           detectPatterns(), statsFromLog()
│   ├── distractors.ts        pickDistractors() for choice questions
│   ├── scheduler.ts          Leitner boxes, smart session planning, column progress
│   ├── progress.ts           day streak, time limits for timed mode
│   └── strokeMatch.ts        checkStroke(): order, direction and shape of a drawn stroke
├── composables/
│   ├── useStats.ts           localStorage stats, answer log, error tracking, recordAnswer
│   ├── useSetup.ts           script / column / mode / font / count state
│   ├── useSession.ts         active quiz session state and logic
│   ├── useAppUpdate.ts       picks up a new build of the PWA
│   └── useQuiz.ts            orchestrator; exports QUIZ_KEY and QuizContext
└── components/
    ├── SetupScreen.vue       home: Practice tab, tab bar, session options
    ├── QuizScreen.vue        question card, input, feedback
    ├── ResultsScreen.vue     score, what changed, missed kana
    ├── ProgressTab.vue       summary, kana chart, patterns, open errors, stats table
    ├── KanaChart.vue         kana table colored by learning stage
    ├── KanaSheet.vue         detail sheet for one kana
    ├── StrokesTab.vue        Writing tab: watch, trace, write
    ├── StrokeDemo.vue        animated stroke order of one kana
    ├── StrokeCanvas.vue      drawing area for trace and recall, judges each stroke
    ├── ColumnSelector.vue    kana row grid (props/emits)
    ├── PatternCards.vue      detected pattern cards (props/emits)
    ├── SettingsSheet.vue     kana font, backup, reset
    ├── BottomSheet.vue       sheet with focus handling
    └── Icon.vue              stroke icons
```

## Debugging on a phone

- `?eruda` loads an on-page console
- `?debug` shows the stroke matcher's distances under the drawing area, for tuning the thresholds in `src/learning/strokeMatch.ts`

## Credits

Stroke order data comes from [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). `src/data/strokes.ts` is derived from it and shares that license. To regenerate it (needs network access, pinned to a KanjiVG release):

```sh
node scripts/extract-strokes.mjs
```

Behind a proxy, Node's `fetch` ignores `HTTPS_PROXY` unless told otherwise:

```sh
NODE_USE_ENV_PROXY=1 node scripts/extract-strokes.mjs
```

### Kanji data

`src/data/kanjiSource.ts` and `src/data/kanjiStrokes.ts` are generated by `scripts/extract-kanji.mjs` from pinned versions of:

- [KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) and [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project) by the Electronic Dictionary Research and Development Group, [CC BY-SA 4.0](https://www.edrdg.org/edrdg/licence.html), as JSON from [jmdict-simplified](https://github.com/scriptin/jmdict-simplified)
- [JmdictFurigana](https://github.com/Doublevil/JmdictFurigana) for splitting a reading over the kanji, CC BY-SA like JMdict
- [KanjiVG](https://kanjivg.tagaini.net) by Ulrich Apel, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- the JLPT N5 word list of [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) (repository MIT, the data goes back to tanos.co.uk, CC BY)

The generated files share those licences. The EDRDG licence asks for the data to be kept current, so it is rebuilt with every release that touches kanji content and at least twice a year:

1. bump the pinned versions at the top of `scripts/extract-kanji.mjs`
2. run `node scripts/extract-kanji.mjs` (behind a proxy with `NODE_USE_ENV_PROXY=1`)
3. run `pnpm test`

`node scripts/extract-kanji.mjs --candidates` also writes `scripts/.cache/candidates.md`, the words and readings to pick the course content in `src/data/kanjiCourse.ts` from.
