# Learning improvements plan

Status per phase is in section 6. Goal: make the quiz actually help someone learn kana, not just test them. Three pillars: capture better data, detect error patterns and act on them, and add stroke order writing practice.

## 1. What holds learning back today

Findings from reading the code (`src/composables/*`, `src/data/kana.ts`, `src/components/*`):

1. **The wrong answer is thrown away.** `recordAnswer` only gets correct/incorrect and elapsed time. What the user typed or which kana they picked is lost (`useSession.ts`, `submitTyped` / `selectAnswer`). Without it no confusion detection is possible.
2. **Stats are lifetime counters with no timestamps.** A kana missed five times in week one and answered correctly fifty times since still shows five errors, stays in the error tracker, and gets weight five in error practice (`startQuiz(true)`). Nothing decays, no trend, no "forgotten again".
3. **Choice distractors are random** (`makeQuestion`). ぬ is never deliberately tested against め, シ never against ツ. The hard confusions stay hidden and the choice mode is too easy.
4. **Romaji check is a strict string compare** and the data has `di`/`du` for ぢ/づ (nonstandard, Hepburn is `ji`/`zu`). `si`, `ti`, `tu`, `hu`, `zi`, `nn` are all counted wrong although they are valid Kunrei/Nihon-shiki or common typing habits. That produces false errors that pollute the stats.
5. **No notion of "not yet seen".** Stats only cover kana the user has met. Nothing tells the user which columns to learn next or which ones are mastered. The column selector only has an error dot.
6. **No production of kana.** The app tests reading (type romaji) and recognition (pick kana). Writing by hand is the strongest memory anchor and is missing entirely.
7. **Practice entry points are static filters.** Weak (< 80 %), slow (> 3 s) and errors exist and are a good base, but there is no scheduling and no mixing of new, due and weak material.

## 2. Data model changes (foundation for everything else)

Additive changes, old data migrates on load. Bump the key to `kana_stats_v3`, `loadStats` reads v2 and fills defaults.

### `StatEntry` gains

- `lastSeen: number`, `lastWrong?: number` (ms epoch)
- `streak: number`, correct answers in a row, reset on error
- `confusions: Record<string, number>`, wrong answer given, mapped to count. For typed answers the normalized romaji, for choice the chosen kana, for draw the stroke index (see section 5).
- `byDirection: Record<QuizDirection, { correct: number; incorrect: number }>` so reading, recognition and writing are tracked separately
- `box: number` (Leitner box 0 to 4) and `due: number` (next review time)

### New answer log

`kana_answers_v1`: ring buffer of the last ~1000 answers, `{ kana, direction, correct, given, ms, t }`. Enables 7-day accuracy, "slipping" detection and session history. Capped so localStorage stays around 60 KB.

### `recordAnswer` signature

Replace the five positional args with one object: `{ kana, romaji, script, direction, correct, given, elapsedMs }`. `RecordFn` in `useSession.ts` changes accordingly.

### `KanaColumn.romaji` becomes primary plus alternates

Keep `romaji: string[]` as the Hepburn display form, add `alt?: string[][]` per kana for accepted alternatives. Fix ぢ to `ji` and づ to `zu`.

### New data file `src/data/lookalikes.ts`

Curated groups of visually confusable kana with a one-line hint each. Hiragana examples: ぬ/め, ね/れ/わ, は/ほ/ま, さ/き/ち, る/ろ, あ/お, い/り, こ/に, た/な, け/は, ゆ/よ. Katakana examples: シ/ツ, ン/ソ, ク/ケ/タ, ワ/フ/ウ, コ/ユ, ナ/メ, ヌ/ス, チ/テ, ア/マ, ル/レ, ロ/コ. Used for distractors, hints and pattern detection.

## 3. Automatic error pattern detection

Pure functions in `src/learning/patterns.ts`, no Vue. Input: `StatsMap` plus answer log. Output: `Pattern[]` with `{ kind, title, detail, kana, severity, practicePool }`. Rendered as cards on the results screen ("this round") and on the stats tab ("all time"), each with a "Practice this" button that starts a session from `practicePool`.

Detectors:

1. **Confusion pairs.** From `confusions`: kana A answered as B at least twice. Merge symmetric pairs. "You confuse ぬ with め." Practice pool: both kana plus their lookalike group, in choice mode with each other as distractors.
2. **Row and column clusters.** Aggregate errors per consonant row (ka, sa, ta, ...) and per vowel column (a, i, u, e, o) per script. Flag a row or column with at least three errors and accuracy below 70 % while overall accuracy is above 70 %. "Most errors are in the ra row." "u-vowel kana are weak."
3. **Mark confusion.** Base kana fine but dakuten/handakuten form wrong (き ok, ぎ wrong, or ば vs ぱ). Combo kana (small ゃゅょ) as its own cluster.
4. **Script gap.** Katakana accuracy trails hiragana by 20 points or more.
5. **Direction gap.** Per kana and overall: recognized but not read, read but not written. "You recognize は but cannot write it."
6. **Slow but correct.** Accuracy at least 90 % but average time above twice the user's median. Not automatic yet. Practice pool goes into a fluency drill.
7. **Slipping.** High lifetime accuracy but two or more errors in the last seven days (from the answer log).
8. **Lookalike blind spot.** Errors on one member of a lookalike group, the other member never seen. Suggest practicing the group together.
9. **Typo filter.** Typed answer with Levenshtein distance 1 and same length as the expected romaji counts as a typo: still wrong, shown as "typo?", but not fed into `confusions`. Keeps the pattern data clean.

The results screen runs the detectors on this round's answers only, the stats tab on everything.

## 4. Smarter quizzing (uses the data above)

1. **Targeted distractors.** Build the three wrong options in this order: personal confusions for this kana, lookalike group, same row or same vowel, random fill.
2. **Romaji tolerance.** Accept alternates, show the Hepburn form in the feedback when an alternate was used.
3. **Re-ask within the session.** A kana missed in this session is queued again three to six questions later, at most twice. Cheap and effective.
4. **Explain the error.** After a wrong answer show the given answer next to the correct one. If the pair is a known lookalike, show both kana side by side with the hint from `lookalikes.ts`.
5. **Adaptive "Smart practice" session.** Leitner scheduling with boxes 0 to 5. Correct and due: box + 1, `due` = now + [0, 1, 3, 7, 14, 30] days by the new box. Correct but not due yet: no change, so repeating a kana in one sitting doesn't fake mastery. Wrong: box 0, due now. Typos leave the box alone. A session is built from due kana (lowest box, most overdue first), weak kana (30 % or more errors in the last ten answers of that kana), up to five unseen kana in table order from the selection (or the whole table if nothing is selected), and the kana due next as fill. New kana are held back while ten or more kana sit in box 0 or 1. Each new kana gets an intro card (kana, romaji, lookalike warning) and two tests, interleaved with the other new kana. Error practice weighting moves from lifetime error count to recent error rate so mastered kana drop out by themselves.
6. **Coverage in the column selector.** Replace the single error dot with three states: unseen, learning, mastered (all kana in the column at box 3 or higher). Gives the user a map.
7. **Fluency mode (later).** Per-question countdown, targets the "slow but correct" pattern.

## 5. Stroke order practice

### Data

- Source: KanjiVG (CC BY-SA 3.0). It has SVGs for every hiragana and katakana, one ordered `<path>` per stroke, viewBox `0 0 109 109`, file named by codepoint (あ is `03042.svg`, が is `0304c.svg`, so dakuten forms need no composing).
- `scripts/extract-strokes.mjs`, run by hand, output committed: fetches the needed SVGs from a pinned KanjiVG release tag and writes `src/data/strokes.ts` as `Record<string, StrokeData>` (path `d` strings plus KanjiVG's stroke number positions). 142 glyphs, about 50 KB.
- Combos (きゃ) are two glyphs. Phase one covers monographs only. Combos can be added later by drawing the two glyphs in sequence.
- KanjiVG attribution goes into the README and a small about line in the app.

### Components

- `StrokeDemo.vue`: animated playback of one kana, stroke by stroke with stroke numbers, using `stroke-dasharray` / `stroke-dashoffset`. Replay button. Used in watch mode and as a hint.
- `StrokeCanvas.vue`: SVG with the same viewBox. Layers: optional faint guide glyph, reference strokes revealed so far, user ink as polylines, hint for the next stroke (start dot plus animated dash). Pointer events (`pointerdown` / `pointermove` / `pointerup`, `touch-action: none`), points converted to SVG coordinates via `getScreenCTM().inverse()`.
- `src/learning/strokeMatch.ts`, pure and testable:
  - Reference strokes resampled once to 24 equidistant points per stroke (runtime, hidden SVG path plus `getPointAtLength`, cached per kana).
  - User stroke resampled to 24 equidistant points.
  - Checks, all generous and tuned on a real phone: start point within ~20 units of the reference start, end point within ~20 units of the end, mean point distance under ~15, length ratio between 0.5 and 2. If start and end only pass when swapped, report "wrong direction".
  - Compare against the expected next stroke first. If that fails, test the remaining strokes: a match there means "wrong order, that was stroke N". Very short strokes (dots, dakuten marks) skip the direction check.
  - A `?debug` overlay (same idea as the existing `?eruda` switch) shows the distances so thresholds can be tuned on device.

### Modes

1. **Watch.** Animation with numbers, replay, step through stroke by stroke, previous and next kana. Smart practice intro cards show the same animation, so a new kana is seen being written on first contact.
2. **Trace.** Guide glyph visible, draw stroke by stroke, immediate accept or reject per stroke.
3. **Recall.** Prompt is romaji (optionally audio), no guide. After each stroke: accepted ink stays, rejected ink shakes and clears. After two rejects on the same stroke show the hint, after three draw the stroke for the user. The kana counts as correct only if every stroke was accepted without a hint.

### Integration

- New `QuizMode` value `draw` ("Romaji to Write" as a fourth direction button) and `inputType: 'draw'`. `QuizScreen.vue` renders `StrokeCanvas` instead of the input or the options. Mixed mode includes draw questions.
- New tab "Stroke Order" on the setup screen: grid of the selected kana, tap opens `StrokeDemo` with a "trace it" button. This is the learning entry before quizzing.
- Stats: `byDirection.draw` plus `strokeErrors: number[]` per kana (reject count per stroke index). New patterns: "stroke 2 of ふ in wrong order", and "horizontal strokes drawn right to left" aggregated across kana, because direction mistakes are a habit, not a per-kana thing.
- Results screen shows the user's drawing next to the reference for missed kana as small thumbnails.

### How phase 4 turned out

- Matcher thresholds: start and end within 22 units, mean distance under 16, length ratio 0.5 to 3. Checked against all 419 KanjiVG strokes with simulated input: exact and mildly sloppy strokes (90 % size, shifted 5 units, jitter) are always accepted. At 80 % size, shifted 9 units with strong jitter about 3 % are rejected, all short ticks. Drawing any later stroke in place of the expected one is reported as an order mistake, except swapping the two dakuten ticks, which is harmless. Every reversed stroke longer than 15 units is reported as backwards.
- The upper length limit went from 2 to 3 because shaky short strokes come out more than twice as long. The mean distance check still catches strokes that wander off.
- A drawing counts as correct when no stroke needed a hint and there was no order or direction mistake. One sloppy shape reject is forgiven, so the matcher's own imprecision doesn't fail the kana.
- Draw answers move the Leitner box like any other answer and are kept out of the timing stats.
- Mixed mode includes draw questions. Combos have no stroke data yet, in draw mode they fall back to a choice question.
- Stroke patterns run on the full stats only, the answer log has no stroke details.
- `strokeErrors` counts rejects per stroke index, `strokeFaults` per fault kind. The "horizontal strokes right to left" idea became a general "strokes drawn backwards" habit, since the matcher doesn't classify stroke orientation.

### How phase 5 turned out

- Combos: the extraction also pulls the small ゃゅょャュョ. `kanaStrokes` places the small kana 75 units after the base kana instead of a full cell (109), because KanjiVG draws it in the lower part of its own cell and a full offset left a wide gap. Combos now work everywhere strokes are used: watch, trace, write, draw quiz, intro cards, result thumbnails. The order check also catches strokes of the small kana drawn before the base kana is done.
- Fluency: a "Timed" toggle next to the direction. 3.5 s for typed answers, 3 s for choice, drawing and intro cards are never timed. A timeout counts as wrong in the session (re-asked like any miss) and in the stats, but leaves the Leitner box alone, the same as a typo: being slow means not automatic yet, not forgotten. "Practice slowest" and the "Correct but slow" pattern always run timed.
- Listen → Write: its own direction button. Draw questions where the sound plays automatically and the prompt shows "?" until answered. The answers count as `draw` in the stats. Intro cards play the sound in this mode as well. Mixed mode leaves it out, since it needs sound on.

### Not planned

Free handwriting recognition without stroke order. The matcher is order and direction based on purpose, because that is what should be learned.

## 6. Phasing

Each phase is its own PR.

| Phase | Content | Size | Status |
|---|---|---|---|
| 0 | Stats v3 with migration, record given answer, direction and timestamps, answer log, romaji alternates and the ぢ/づ fix, `lookalikes.ts`, vitest for `src/learning/*` | S | done |
| 1 | Pattern detectors, pattern cards on results and stats, targeted distractors, re-ask within session, error explanation | M | done |
| 2 | Leitner scheduling, Smart practice with intro cards, progress bar per column, recent-rate error practice | M | done |
| 3 | Stroke data extraction, `StrokeDemo`, Stroke Order tab with watch mode, stroke animation on intro cards | M | done |
| 4 | `StrokeCanvas`, matcher, trace and recall modes, draw quiz mode, stroke stats and stroke patterns, drawing thumbnails on results | L | done |
| 5 | Fluency mode, audio-prompted draw, combos in draw mode | S | done |

Phase 3 ships before 4 on purpose: the animated stroke order alone is already useful and the drawing matcher is the riskiest part.

## 7. Decisions taken

Goal for all of them: learn the characters as efficiently as possible.

1. Romaji: Hepburn is the display form, Kunrei spellings and typing habits are accepted. Strict checking produced false errors that polluted the pattern data.
2. Draw mode: monographs first, combos later.
3. Scheduling: Leitner. Simple, transparent, and the box doubles as the mastery level shown per column.
4. vitest for the pure modules in `src/learning/*` and `src/data/lookalikes.ts`. No component tests.
5. KanjiVG (CC BY-SA 3.0) with attribution in the README and in the app.
6. Existing stats are migrated. Old entries get a starting box from their accuracy and are all due once, so the first smart session works as a placement check.
