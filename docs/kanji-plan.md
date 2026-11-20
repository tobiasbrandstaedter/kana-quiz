# Kanji for JLPT N5: plan

How the kanji part gets built with agents. What it has to do is in `kanji-requirements.md` (ids KD, KR, K1 to K5 come from there). Status per phase is in section 5.

## 1. Who does what

| Work | Model | Why |
|---|---|---|
| Requirements, order of the kanji, technical design, the brief for each phase, acceptance at the end of each phase | Fable | Decisions that every later phase lives with. A mistake here costs a rebuild |
| Measurements and implementation of a phase | Opus | Work with a closed brief, a list of files and tests that say when it is done |
| Hand written content: keyword, words, memory hooks, lookalike hints | Fable writes, a separate Opus agent checks it against the source data | The author must not be the checker (KD15) |
| Review of each phase | the `review-*` agents through `/review` | Fresh eyes, they see the diff and not the conversation that led to it |
| Lookups and mechanical follow ups: licence texts, syncing `CLAUDE.md`, credits | Sonnet | Cheap, nothing to decide |

Fable stays the one session that holds the thread. It starts an Opus session per phase, reads the result, runs the review and decides whether the phase is done.

Both documents went through this loop once already: a research agent for sources and licences, then two independent reviewers (one as a teacher and requirements reviewer, one against the code). The design in section 3 is the second version, the first one did not survive the code review.

## 2. Rules for every phase

1. **One phase, one branch, one PR.** Phases run one after the other. Most of them touch `App.vue`, `SetupScreen.vue` and `styles.css`, parallel sessions would only produce merge conflicts. The data phase (P1) is the one piece that can run next to P2.
2. **Closed briefs.** An Opus session starts fresh with: the phase section of this file, the KR ids it has to meet, the files to read first, what must not change, and how to prove it is done. It does not get this conversation.
3. **Content never from memory.** No session writes a reading or a meaning into a file by hand. They come out of the script (KR60). A session that needs an example for a test takes it from the generated data.
4. **Logic in pure modules.** Queue, judging an answer, scoring, unlock rules and wrong options go into `src/learning/*` with vitest tests. The kanji composable only holds refs and calls them. The kana composables have no tests today, the kanji part should not repeat that.
5. **Kana must not change.** After every phase: `pnpm test`, `pnpm type-check`, and one kana smart session clicked through in the preview. A phase that changes kana behavior without saying so in its brief is not done.
6. **Seen in the browser.** UI phases are checked in the preview at phone width (375px), in Playground, Sumi and Yoru, light and dark, with a screenshot per new screen part.
7. **Acceptance by id.** Fable goes through the KR ids of the phase one by one against the running app and the diff, and writes down met, not met, or changed with a reason. A requirement that turned out wrong is changed in the requirements file, not silently skipped.
8. **Docs move with the code.** Each PR updates `CLAUDE.md` for what it added and sets the status in section 5.

## 3. Design

### Kanji next to kana, not inside it

The first idea was one session and one `useQuiz` for both, with a "course" object per script. Reading the code against it showed how much is kana all the way down: `useSession` keys its results, re-asks and drawings by kana and judges typed answers as romaji, `QuizDirection` is at once the question type, the key of `byDirection` and a field of the answer log, `QuizScreen` looks up twins, lookalikes, memory hooks and sound for a kana by itself, `KanaChart` lays out its grid by vowel, `KanaSheet` only renders for a kana pair. None of the composables has tests. Pulling a second content model through all of that would put the working kana part at risk for the sake of sharing maybe a hundred lines of queue state. And the kanji quiz card is a different card anyway: no romaji, words, a kana preview, the meaning after the answer.

So:

- **The kana composables and screens stay as they are.** `useSession`, `useQuiz`, `QuizScreen`, `ResultsScreen`, `KanaSheet`, `KanaChart` are not generalized.
- **Kanji gets its own composable and its own screens**, in a chunk that is loaded when Kanji is picked: `useKanji` (stats, plan, session, provided under its own injection key), a quiz screen, a results screen, the contents of the three tabs, the chart, the sheet.
- **The shell is shared:** greeting, streak, script switch, tab bar, toast, update banner, settings. `App.vue` and `SetupScreen.vue` show the kanji parts when the script is `kanji`.
- **Shared code is pure functions and components without content of their own:**
  - from `scheduler.ts`: `review`, `isDue`, `dueAt`, `reaskSlot`, `MASTERED_BOX`, the intervals. `orderSession` and `recentErrors` get an id accessor instead of reading `.kana`
  - `shuffle`, `streak`, `dayKey`, `strokeMatch.ts`, `format.ts`
  - the re-ask insertion, moved out of `useSession` into a tested pure function that both sessions call
  - `StrokeDemo` and `StrokeCanvas`, which take the stroke data as a prop where they look it up themselves today
  - `BottomSheet`, `Icon`, `PatternCards`, the styles
- **Accepted cost:** the kanji session repeats some state handling of `useSession` (current card, answered, feedback). If a third script ever comes, that is the moment to pull it together, not now.

### Types

Kanji and words get their own types next to the kana ones, nothing is squeezed into `KanaPair` or `StatEntry`.

- Question type: `'meaning' | 'recognize' | 'word-meaning' | 'read-choice' | 'read-type' | 'spell' | 'write'` (M1, M2, V1, R1, R2, S1, W1 in the requirements).
- A word id is form plus reading (`w:一日:ついたち`), two words can share a form (KR78).
- Stat entry per item: id (`k:日`, `w:日本`), the counters and schedule fields `StatEntry` has, results per question type in place of `byDirection`, the kinds of reading mistakes for words.
- Answer record: `{ id, type, correct, given, ms, t }`.

### Storage

- New keys `kanji_stats_v1`, `kanji_answers_v1` (its own log, so kanji answers don't push kana answers out of the 1000 the kana patterns read) and `kanji_prefs` (mode, picked sets, new kanji per session with a default of 3). The kana prefs keep their one `mode`, the kanji modes are different ones.
- The day counter moves into one small module with one write function that both stat stores call. Today `useStats` owns the ref behind the streak, a second writer would leave it stale.
- A small module outside the chunk knows the kanji keys and can count due items from `kanji_stats_v1`. The due dot (KR43), Reset (KR67) and the backup need that without loading the kanji data.
- Backup: version 2 carries the kanji keys. The app reads 1 and 2. Restoring a version 1 backup leaves kanji progress alone, since that backup can't know about it. Restoring a version 2 backup replaces everything, as today. The confirm step says how many kana and how many kanji the backup holds. The check for an empty backup accepts kanji progress alone.
- Expected size: about 350 entries, well under 200 KB with the log.

### Data

- `scripts/extract-kanji.mjs`, run by hand, output committed, same idea as `extract-strokes.mjs`: pinned versions of the sources, downloads kept in a folder git ignores.
- Sources, as far as checked on 2026-11-20:
  - KANJIDIC2 and JMdict as JSON from the releases of `scriptin/jmdict-simplified` (weekly, tag like `3.6.2+20261116213322`): `kanjidic2-en` (1.25 MB zipped) and `jmdict-eng-common` (1.45 MB zipped). A kanji has `misc.jlptLevel` (former levels, 4 is the set), `misc.strokeCounts`, and readings typed `ja_on` and `ja_kun` with English meanings. A word has `kanji[]`, `kana[]` with `appliesToKanji`, and `sense[].gloss[]`. The assets are zip files and Node has no unzip built in, P1 picks between a small reader on `zlib` and the XML from edrdg.org (`kanjidic2.xml.gz`, gunzip is built in).
  - N5 word list: `jamsinclair/open-anki-jlpt-decks`, `src/n5.csv` (about 718 rows: expression, reading, meaning). Repo is MIT, the data goes back to tanos.co.uk, which states CC BY. It has no JMdict ids, matching by written form and reading is our step.
  - KanjiVG at the tag `extract-strokes.mjs` already pins. The kanji files carry the parts as `kvg:element` on groups, with `kvg:original` for a radical form (亻 is 人), so the hand written parts can be checked by the script.
- Licences: EDRDG data is CC BY-SA 4.0, the generated files carry that licence in their header like `strokes.ts` does. The app needs a Sources screen (KR63) and the data has to be kept current (KR70). KANJIDIC's SKIP codes are non commercial, the script does not copy them.
- Hand written input in `src/data/kanjiCourse.ts`: the sets and their order, keyword, parts, first word, the picked words with a short gloss, the word groups as counter plus numbers, memory hooks, lookalike groups, the pairs of meanings too close to offer together (KR15). It holds no readings. Where two words share a form, the hand written entry names the JMdict id.
- Generated by `extract-kanji.mjs`: `src/data/kanjiSource.ts` (per kanji the source meanings and the on and kun readings, per picked word the JMdict readings and glosses, the split of each reading over its kanji and the special flag, per group the members JMdict has with reading and the computed irregular mark) and `src/data/kanjiStrokes.ts` (same shape as `strokes.ts`). The script stops with a message that says what to fix when a picked word is not in JMdict or contains a kanji outside the set. A group member JMdict does not have is left out and listed in the output of the run.
- Tests in `src/data/kanjiCourse.test.ts` hold KR1 to KR10, KR61 and KR73 to KR75 against these files.

### Loading and offline

- The kanji data, composable and components sit behind one dynamic import (KR65). Nothing of it is parsed at app start.
- The service worker precaches every chunk at install (`globPatterns` in `vite.config.js`), so the kanji chunk is downloaded in the background by everyone and is there offline. That is accepted: a few hundred KB once, against a kanji part that fails on the train. P0 checks the chunk stays far below the 2 MiB above which workbox silently skips a file.
- The font cache in `vite.config.js` allows 80 entries. Japanese fonts come in many small slices, the kanji will pull in more of them per family. The limit goes up in P2, or kana lose their font offline.

### Splitting a reading over the kanji

Needed for the on and kun labels, for "another reading of the same kanji" as a wrong option (KR17) and for the special flag (KD14). The splits come from JmdictFurigana (CC BY-SA, keyed by written form plus reading). A reading it gives as one block over several kanji (今日[きょう]) is a special reading. On or kun is found by comparing the part of a kanji with its KANJIDIC2 readings, voicing and a small っ allowed.

### Typing readings

- A pure module `src/learning/kanaInput.ts` turns typed romaji into hiragana (KR21) and names the kind of a wrong reading (KR22). It builds on the spellings `romaji.ts` accepts.
- The field keeps what was typed. The hiragana shows as a preview right next to it. Rewriting the value of an input while the iOS keyboard is typing into it breaks in ways that cost days, and a lone `n` can't be decided before the next key anyway. On send, a trailing `n` is ん.
- Order of the checks on a wrong answer: first the named kinds of KR22, compared in kana. Only what is left over can be a typo (KR23).

### Stroke check

`checkStroke` takes the first fit against fixed thresholds (ends within 22 units, mean within 16). In a dense kanji parallel strokes lie 8 to 12 units apart, so stroke 4 drawn in place of stroke 3 can pass as stroke 3, and an order mistake goes unseen. Ticks under 15 units skip the direction check, and kanji have many of those. P0 measures both. If the check needs to change (best fit over the open strokes, thresholds scaled to the nearest neighbor), it comes as a parameter the kanji canvas sets, the kana call stays as it is.

## 4. Phases

### P0: measure

Opus, one session, no product code. Results go into section 6.

- The list: count the kanji with level 4 in KANJIDIC2 itself and compare with the list in KD1 (a first count through a third party file gave 102, 103 is usually quoted).
- Stroke check on kanji: run `checkStroke` over every stroke of the set with simulated input, the way phase 4 of the kana plan did (exact, sloppy, reversed, each later stroke in place of the expected one). Report rejects of honest strokes, and above all false accepts: a later stroke taken for the expected one, a reversed stroke let through. 語, 読, 聞, 駅 (14 strokes) and 曜 (18) are the hard cases.
- Fonts: which fonts of the picker have every kanji of the set as a glyph, and how many font files one family needs for them. All seven declare the Japanese subset, the glyphs themselves are unchecked.
- Size: stroke data and course data for the set, raw and gzipped.
- Number words: which members of the groups in KR73 are JMdict entries (三百, 四時, 一分, 九月, 二十日 ...). A group that is mostly missing changes KD17.
- Licence: read edrdg.org/edrdg/licence.html and write down what exactly an app with a small pinned extract has to do (KR63, KR70). Same for JmdictFurigana.
- Voice: does `speechSynthesis` speak Japanese on iOS Safari, in the installed PWA and on Android Chrome, and what does `getVoices()` report there. This one needs a real iPhone, so the owner runs a test page the session prepares. It is the only step in the plan that needs a person. If nobody gets to it, K2 ships with the button shown wherever `speechSynthesis` exists.

Done when the results are written down and Fable has confirmed or changed KD1, KD11, KD13, KD17, KR65, KR69 and KR70.

### P1: data

Opus builds the script, the generated files and the tests. Fable writes the hand written content, a separate Opus agent checks it (KR62). Can run next to P2. The data covers kanji and words in one go, although words only show up in K2: the order of the kanji depends on the words (KR3).

Done when the script reproduces its output, the tests for KR1 to KR10, KR61 and KR73 to KR75 pass, every kanji has keyword, set and first word, and the reviewer's findings are worked in.

### P2: groundwork

Opus. No visible change, small on purpose.

- The re-ask insertion out of `useSession` into a pure function, with tests, `useSession` calls it.
- `orderSession` and `recentErrors` with an id accessor, tests extended.
- `StrokeDemo` and `StrokeCanvas` take the strokes as a prop, the kana callers pass what they got from `kanaStrokes` before.
- The day counter as its own module.
- Backup version 2, the kanji keys in Reset, the module that knows the kanji keys.
- `lang="ja"` on Japanese text (KR57), the font cache limit.

Done when all tests pass, type check is clean, a kana session with a miss and a draw question behaves as before in the preview, and a backup made before the change still imports.

### P3a: K1, practice

Opus. The chunk and its loading, Kanji in the script switch with the due dot, kanji stats, intro card, `meaning` and `recognize`, smart practice with the three mode tiles, quiz screen, results screen. The custom quiz comes in P3b with the set picker, without sets there is nothing to pick from. New card styles first: a keyword list in the choices, kanji in the choices at a size where 土 and 士 differ at 375px.

Done when a new learner can go through set 1 in the preview and come back the next day to reviews, and the KR ids of K1 that concern practice are met.

### P3b: K1, the rest

Opus. Set picker, Practice tab hero and tiles, Writing tab with Watch and Trace, Progress tab with chart, open errors and table, kanji sheet, Sources section.

Done when every KR id of K1 is met.

### P4a: K2, words

Opus. Words in the plan with the unlock rules and the six card budget (KR14), word intro, `word-meaning`, `read-choice`, `spell`, words in sheet, table and results.

Done when a new learner in the preview gets through the first two sets, words included, without a card that asks for something not taught, and the first session with a length of 10 and of 20 fills the way KR14 says.

### P4b: K2, typing and sound

Opus. `kanaInput.ts`, `read-type`, the named kinds of reading mistakes in the feedback, the sound button.

Done when every KR id of K2 is met.

### P5: K3, groups

Opus. Group card with the table, groups in the plan, in the sheet and in the feedback of their members.

### P6: K4, patterns

Opus. Kanji detectors in a module of their own next to `patterns.ts`, cards on results and Progress.

### P7: K5, writing

Opus, only if P0 says the stroke check holds or can be made to. Draw mode for kanji, Write on the Writing tab.

## 5. Status

| Phase | Content | Status |
|---|---|---|
| P0 | Measure the list, stroke check, fonts, size, number words, licence, voice | done, voice not measured |
| P1 | Data script, course content, checks | done |
| P2 | Groundwork, no visible change | done |
| P3a | K1 practice | done |
| P3b | K1 the rest | open |
| P4a | K2 words | open |
| P4b | K2 typing and sound | open |
| P5 | K3 groups | open |
| P6 | K4 patterns | open |
| P7 | K5 writing | open, depends on P0 |

## 6. Results of P0

Measured on 2026-11-20. Downloads are in `scripts/.cache/sources/`, the throwaway scripts and their raw output in `scripts/.cache/p0/` (both git ignored). The voice test is not part of this run.

Sources and pinned versions:

| Source | Version | URL | Local file |
|---|---|---|---|
| KANJIDIC2 (JSON) | jmdict-simplified `3.6.2+20261116213322`, dictDate 2026-11-16, databaseVersion 2026-320 | `https://github.com/scriptin/jmdict-simplified/releases/download/3.6.2%2B20261116213322/kanjidic2-en-3.6.2%2B20261116213322.json.tgz` | `kanjidic2-en-3.6.2+20261116213322.json.tgz`, unpacked `kanjidic2-en-3.6.2.json` |
| JMdict common | same tag | `.../jmdict-eng-common-3.6.2%2B20261116213322.json.tgz` | `jmdict-eng-common-3.6.2+20261116213322.json.tgz`, `jmdict-eng-common-3.6.2.json` |
| JMdict full | same tag | `.../jmdict-eng-3.6.2%2B20261116213322.json.tgz` | `jmdict-eng-3.6.2+20261116213322.json.tgz`, `jmdict-eng-3.6.2.json` |
| KanjiVG | tag `r20260714` | `https://raw.githubusercontent.com/KanjiVG/kanjivg/r20260714/kanji/<code>.svg` | `kanjivg-r20260714/*.svg` (104 files) |
| N5 word list | commit `9b20cfa8d59e56018702543aa9060cb72a263692` (last commit on the file, 2023-07-16; repo HEAD `1ad66734`) | `https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/9b20cfa8d59e56018702543aa9060cb72a263692/src/n5.csv` | `n5.csv` |
| JmdictFurigana | release `2.3.1+2026-10-25` | `https://github.com/Doublevil/JmdictFurigana/releases/download/2.3.1%2B2026-10-25/JmdictFurigana.json.tar.gz` | `jmdictfurigana-2.3.1/JmdictFurigana.json` (+ `.tar.gz`, `README.md`) |
| EDRDG licence | page as of 2026-11-20 | `https://www.edrdg.org/edrdg/licence.html` | `edrdg-licence.html`, `edrdg-licence.txt` |
| Google Fonts css2 | fetched 2026-11-20 with a Chrome 142 desktop User-Agent | `https://fonts.googleapis.com/css2?family=<spec>&display=swap` | `google-fonts-css/*.css` |

The jmdict-simplified assets come as `.tgz` too, not only `.zip`, so `tar`/gunzip is enough. tanos.co.uk is blocked by the proxy here (HTTP 502), the CC BY claim for the N5 list was not checked at the source.

### 6.1 The list

- KANJIDIC2 has **103** kanji with `jlptLevel` 4:
  `安一飲右雨駅円下何火花会外学間気休魚金九空月見言古五午後語口校行高国今左三山四子時耳七社車手週十出書女小少上食新人水生西先千川前足多大男中長天店電土東道読南二日入年買白八半百父分聞母北本毎万名木目友来立六話`
- Difference to the 102 of section 12 (17 sets minus 曜): one kanji, **新**, is in KANJIDIC2 and not in the draft. Nothing in the draft is missing from KANJIDIC2, no duplicates.
- 新 has level 4 (grade 2, 13 strokes).
- 曜 is not in the list. KANJIDIC2 gives it the former level **3** (grade 2, 18 strokes).
- Set used for everything below: the 103 plus 曜, 104 kanji. Most strokes: 駅 語 読 聞 14, 新 電 話 13, 飲 12, 曜 18.

### 6.2 Stroke check

Method (`scripts/.cache/p0/strokes.mjs`): every stroke of the 104 kanji (656 strokes) sampled to 24 points the way `StrokeCanvas` does, input fed as a polyline with a point about every 3 units. A Node path sampler handles the commands KanjiVG uses (M, C, c, S, s). Cross-check: the same 1089 strokes (433 kana from `strokes.ts`, 656 kanji) sampled with `getPointAtLength` in the browser preview differ from the Node sampler by at most 0.008 units. Sloppy input: 20 trials per stroke with a random shift direction, fixed seed. Kana run the same way as a baseline.

checkStroke as it is today:

| | Kanji (656 strokes) | Kana (433 strokes) |
|---|---|---|
| Strokes under SHORT_STROKE (15 units), never checked for direction | 51 | 85 |
| Exact stroke rejected | 0 | 0 |
| Mild (90 % around the stroke's centre, shift 5, jitter 1.5) rejected | 0 of 13120 | 0 of 8660 |
| Mild with the whole glyph at 90 % around the centre of the box | 0 of 13120 | 0 of 8660 |
| Rough (80 %, shift 9, jitter 3) rejected | 26 of 13120, 15 strokes, all `shape` | 33 of 8660, 22 strokes, all `shape` |
| Reversed stroke let through | 124 (51 short ones plus 73 longer than 15 units) | 126 (85 short plus 41 longer) |
| Later stroke j drawn exactly in place of i: ok (order unseen) | 72 of 2345 pairs (3.1 %) | 40 of 536 (7.5 %) |
| same: `order` | 2273 (96.9 %) | 496 (92.5 %) |
| same: `shape` / `direction` | 0 / 0 | 0 / 0 |

- Rough rejects in kanji: 雨火外国左四女人生多大南買万名.
- The 73 longer reversed strokes that pass are 15 to 46 units long with start and end within 22 units of each other, so the reversed drawing fits forward (e.g. 学6 44 units, 魚2 46, 読6 35, 週7 30, and 曜3 4 6 7 9 10). The kana baseline has the same effect (41 strokes, e.g. に2 49 units, the handakuten circles 45). This does not match the note in phase 4 of the kana plan that every reversed stroke over 15 units is caught.
- False accepts on order: 28 of 104 kanji have at least one. Of the 72, 5 are dot against dot (駅 8for7 9for8 10for9, 電 6for5 8for7), 67 involve a longer stroke, 55 of them are the next stroke (j = i + 1). In kana all 40 are the two dakuten ticks swapped.
- Ten worst kanji (ok pairs / pairs): 読 7/91, 駅 6/91, 曜 6/153, 週 5/55, 書 4/45, 電 4/78, 語 4/91, 聞 4/91, 高 3/45, 買 3/66.
- The hard cases:

| Kanji | Strokes | Pairs | ok | order | shape | Pairs let through (j for i) |
|---|---|---|---|---|---|---|
| 語 | 14 | 91 | 4 | 87 | 0 | 3for2 4for3 7for5 7for6 |
| 読 | 14 | 91 | 7 | 84 | 0 | 2for1 3for2 4for3 6for5 7for5 10for8 12for10 |
| 聞 | 14 | 91 | 4 | 87 | 0 | 4for3 8for7 12for11 13for12 |
| 駅 | 14 | 91 | 6 | 85 | 0 | 3for1 4for2 5for4 8for7 9for8 10for9 |
| 曜 | 18 | 153 | 6 | 147 | 0 | 7for6 10for9 14for13 16for14 17for16 18for17 |

Alternative tried, best fit: stroke i is accepted only if no later stroke fits with a lower mean distance (forward, and reversed for short strokes), thresholds unchanged.

| | Kanji | Kana |
|---|---|---|
| Later stroke in place of i: ok | 0 of 2345 (all 2345 `order`) | 0 of 536 |
| Exact stroke rejected | 0 | 0 |
| Mild, stroke scaled around its centre | 11 of 13120 rejected as `order`, strokes in 駅 電 聞 | 119 of 8660, all dakuten ticks, as `order` |
| Mild, whole glyph at 90 % | 162 of 13120 rejected as `order`, 32 strokes in 18 kanji: 飲駅間気見語高週書多男長電読買聞話曜 | 0 |
| Rough | 437 of 13120 (411 `order`, 26 `shape`), 120 strokes in 44 kanji | 318 (285 `order`) |
| Reversed let through | 124, unchanged | 126, unchanged |

So best fit removes every simulated order false accept, and in exchange turns some honest sloppy strokes into `order` faults, which count against a correct drawing. It does nothing for the reversed strokes.

### 6.3 Fonts

Each spec fetched the way `loadKanaFont` builds it (weight 700, Kosugi Maru regular), plus Shippori Mincho 800 that the Sumi theme loads. Coverage is by `unicode-range` of the `@font-face` blocks, the glyph tables of the font files were not opened.

| Family | Faces | Kanji of the 104 missing | Slices for the kanji | Slices for kana | Kana plus kanji |
|---|---|---|---|---|---|
| Zen Maru Gothic 700 | 122 | 0 | 21 | 3 | 22 |
| Noto Sans JP 700 | 124 | 0 | 21 | 3 | 22 |
| Noto Serif JP 700 | 124 | 0 | 21 | 3 | 22 |
| M PLUS Rounded 1c 700 | 126 | 0 | 21 | 3 | 22 |
| Kosugi Maru 400 | 121 | 0 | 21 | 3 | 22 |
| BIZ UDGothic 700 | 124 | 0 | 21 | 3 | 22 |
| Shippori Mincho 700 | 122 | 0 | 21 | 3 | 22 |
| Shippori Mincho 800 | 122 | 0 | 21 | 3 | 22 |

- The 22 slices of Zen Maru Gothic 700 that kana plus the kanji touch weigh 274 228 bytes together.
- Cache in `vite.config.js` (committed state on `kanji-n5`; the working tree had 400 from other work at the end of this run): `google-fonts` with `maxEntries: 80`, one entry per stylesheet and per font file. One family with kanji needs 1 stylesheet plus 22 files, Nunito comes on top. Two families: about 46 entries. Four or more families used with kanji go over 80. The kana UI text outside the 104 kanji and kana is not counted here.

### 6.4 Size

| Data | Raw | gzip |
|---|---|---|
| Kanji strokes, 104 kanji, shape of `strokes.ts` (paths and numbers) | 68 291 B | 27 341 B |
| Kana `strokes.ts` today, for comparison | 51 647 B | 14 664 B |
| KANJIDIC2 part: all on and kun readings, English meanings, stroke count for 104 kanji | 18 307 B | 3 965 B |
| Words: the 168 matched N5 rows of 6.6 with id, form, reading and up to 3 x 3 glosses | 31 177 B | 7 231 B |

KANJIDIC2 averages 4.5 readings and 2.6 English meanings per kanji of the set. Data together about 118 KB raw and 39 KB gzipped, code of the chunk not included. The workbox limit is 2 MiB per file.

### 6.5 Number words

Looked up in jmdict-eng (219 127 entries), with jmdict-eng-common (22 661) for the common flag. A member counts when an entry has the written form with a reading that applies to it. "uc" means the reading is not marked common.

| Group | Entries | Missing | Not in the common file |
|---|---|---|---|
| 二百 to 九百 | 8 of 8 | none | 五百 六百 七百 八百 九百 |
| 二千 to 九千 | 4 of 8 | 二千 五千 六千 九千 | 七千 八千 |
| 一時 to 十二時, 何時 | 13 of 13 | none | 二時 五時 六時 八時 九時 十時 十一時 十二時 |
| 一分 to 十分, 何分 | 11 of 11 | none | 三分 四分 六分 七分 八分 九分 |
| 一月 to 十二月, 何月 | 13 of 13 | none | 何月 |
| 一日 to 十日, 二十日 | 11 of 11 | none | none |
| 一人 to 十人, 何人 | 11 of 11 | none | 五人 六人 七人 八人 九人 十人 |
| 一つ to 九つ, 十 (とお) | 10 of 10 | none | none |
| 日曜日 to 土曜日, 何曜日 | 8 of 8 | none | 何曜日 |

Readings found:

- Hundreds: にひゃく, さんびゃく, よんひゃく, ごひゃく (uc), ろっぴゃく (uc), ななひゃく/しちひゃく (uc), はっぴゃく (uc), きゅうひゃく/くひゃく (uc).
- Thousands: さんぜん, よんせん, ななせん/しちせん (uc), はっせん (uc).
- Hours: いちじ (一時 also has ひととき, いっとき), にじ (uc), さんじ, よじ (四時 also しじ uc), ごじ (uc), ろくじ (uc), しちじ (no ななじ), はちじ (uc), くじ (uc), じゅうじ (uc), じゅういちじ (uc), じゅうにじ (uc), なんじ (何時 also いつ, なんどき).
- Minutes, each as its own entry next to entries for other senses (いちぶ, にぶん, ごぶ, じゅうぶん ...): いっぷん (uc), にふん (uc), さんぷん (uc), よんぷん (uc), ごふん (uc), ろっぷん (uc), ななふん (uc), はっぷん (uc), きゅうふん (uc), じゅっぷん/じっぷん (uc), なんぷん (common).
- Months: いちがつ to じゅうにがつ all common, しがつ, しちがつ (なながつ uc), くがつ; なんがつ (uc).
- Days of the month: 一日 has ついたち (entry 2225040, common) and いちにち (entry 1576260, common) as separate entries, plus つきたち, ひとひ, いっぴ (uc). ふつか, みっか, よっか, いつか, むいか, なのか, ようか, ここのか, とおか, はつか, all common.
- People: ひとり, ふたり, さんにん, よにん common; ごにん to じゅうにん (uc, くにん/きゅうにん, しちにん/ななにん); なんにん common.
- Things: ひとつ to ここのつ all common, 十 has じゅう, とお (common) and と.
- Weekdays: にちようび to どようび all common, なんようび (uc).

Stand alone words, all entries marked common and in the common file: 火 ひ (1193610, "fire"), 土 つち (1445270, "earth"), 天 てん (1438210, "sky"), 気 き (1221520, "spirit"), 友 とも (1539980, "friend"). 友達 (1540170) has the form 友だち, also marked common, readings ともだち/トモダチ.

### 6.6 N5 word list

- `n5.csv` has 718 rows (columns expression, reading, meaning, tags, guid).
- 155 rows are kana only, 169 are written with kanji of the set and kana only, 394 have another kanji or other characters (`～`, `;` between alternatives, brackets).
- Of the 169, **168** match a JMdict entry by written form and reading, all 168 are in the common file. The one miss is 十 with the reading field `(〜を) とお`, a formatting quirk of the row. 何 (なん; なに) matches two entries.
- Not counted in the 169: 18 counter rows with `～` whose kanji are all in the set (～円 ～か月 ～月 ～語 ～時 ～時間 ～中 ～週間 ～人 ～中 ～時 何～ ～日 ～人 ～年 ～分 ～本 ～前), and 2 rows with alternatives whose first form is in the set (足; 脚, 川; 河).
- Duplicate expressions in the file: 九 ～中 一日 十 ～時 ～人 外 私.
- 日本 is not in the list.
- The 169: 会う 上げる 新しい 後 雨 言う 行く 一 一日 五日 五つ 今 入口 入れる 上 後ろ 生まれる 駅 多い 大きい 大きな お母さん お金 お父さん 男 男の子 大人 女 女の子 外国 外国人 会社 買う 書く 学生 学校 火曜日 木 聞く 北 九 今日 金曜日 九 下さい 口 国 来る 車 月曜日 五 午後 九日 九つ 午前 今年 今月 今週 魚 先 さ来年 三 四 時間 下 七 十 上手 白 白い 新聞 水曜日 少ない 少し 千 先月 先週 先生 外 空 大学 高い 出す 立つ 多分 食べる 小さい 小さな 父 一日 手 出かける 出口 出る 天気 電気 電車 電話 十 十日 年 土曜日 中 長い 七つ 何 七日 名前 二 西 日曜日 飲む 入る 八 二十日 花 話 話す 母 半 半分 東 左 人 一つ 一月 一人 百 二つ 二人 二日 古い 下手 外 本 毎月 毎週 毎日 毎年 前 万 右 水 店 見せる 道 三日 三つ 南 耳 見る 六日 六つ 目 木曜日 安い 休み 休む 八つ 山 八日 四日 四つ 読む 来月 来週 来年 六 分かる

### 6.7 JmdictFurigana

- Licence: the code repo is MIT, the README says the data is under the same licence as JMdict (CC BY-SA).
- Format: one JSON array, 236 694 entries `{ text, reading, furigana: [{ ruby, rt? }] }`, keyed by written form plus reading, no JMdict id. The file starts with a BOM. A special reading spans several kanji in one `ruby` (大人[おとな]). Also offered as a compact text file and as `.zip`.
- Asset used: `JmdictFurigana.json.tar.gz` (5.3 MB, 34.8 MB unpacked) of release `2.3.1+2026-10-25`.
- All 168 matched N5 rows have a split. Sample: 今日[きょう], 一人[ひとり], 学[がっ]校[こう], 毎[まい]日[にち], 大人[おとな], 上手[じょうず], 一日[ついたち], 二十日[はつか], 下手[へた], 午[ご]後[ご], 先[せん]生[せい], 電[でん]車[しゃ], 天[てん]気[き], 名[な]前[まえ], 大[だい]学[がく], 今年[ことし], 外[がい]国[こく]人[じん], 出[で]口[ぐち], 入[いり]口[ぐち], 新[しん]聞[ぶん]. 日本 (not in the N5 list) is 日本[にほん]. 六日 comes split as 六[むい]日[か], not as one special block.

### 6.8 Licence

From `https://www.edrdg.org/edrdg/licence.html`, section 3 and 4:

- Acknowledgement in apps: for smartphone and tablet apps, acknowledgement must be made "on a separate screen accessed from a menu", and "It is not sufficient just to mention it on a start-up/launch page". Software packages also have to provide the documentation and licence files or links to them on the EDRDG site.
- Keeping data current: "there must be a procedure for regular updating of the data from the most recent versions available", and failure to keep versions up to date "is a violation of the licence".
- Other points: the data is CC BY-SA 4.0, users "must NOT claim copyright over that material", commercial use is allowed. KANJIDIC2 has extra conditions for parts held by others (SKIP codes under their own licence, Pinyin, Four Corner, Morohashi, De Roo, Korean readings, Spahn and Hadamitzky descriptors).
- What an app with a small pinned extract has to do: show a Sources screen reachable from a menu that names JMdict and KANJIDIC2, the EDRDG and links to the licence and project pages, and ship the extract under CC BY-SA 4.0. And it needs a written procedure to regenerate the extract from the newest release at regular intervals; the page names monthly only as the example for dictionary web servers.
- JmdictFurigana carries the JMdict licence (CC BY-SA), so a split taken from it needs the same attribution and share alike, with JmdictFurigana named as a source next to JMdict.

### 6.9 Decisions taken from these results

- **KD1 stands, with 新.** The set is the 103 kanji of level 4 plus 曜, 104. 新 goes into set 16 next to 古.
- **KD11 stands, K5 goes ahead, `checkStroke` stays as it is.** It catches 97 % of the order mistakes and rejects no honest stroke. The best fit variant catches all of them but turns down honest strokes (over 1 % when a kanji is drawn a little small), and for a learner a correct stroke called wrong is worse than a wrong one let through. Short strokes drawn backwards pass, as they do for kana. No change to the kana check either.
- **KD13: not measured.** The sound button is shown wherever `speechSynthesis` exists and speaks on tap. If nothing is heard on some device, that is found in use.
- **KD17 stands.** All groups are complete in JMdict except the thousands (4 of 8). The table of a group shows the members JMdict has, so the thousands show 千, 三千, 四千, 七千, 八千. The script reads the full JMdict for group members, the common file is too thin there.
- **Words (KR1, KR5).** Only 169 rows of the N5 list are written with set kanji and kana, and words as basic as 日本 are not in the list at all. So a picked word has to be a common JMdict entry, the N5 list is the first choice, and a word from outside it is allowed with a reason noted in the data. About 150 single words.
- **Splits come from JmdictFurigana** (all matched words are in it). A reading it gives as one block over several kanji is a special reading. No cutting script of our own.
- **KR65 stands.** About 40 KB gzipped for all kanji data.
- **KR69 stands, nothing to build.** Every font of the picker covers all 104 kanji by its declared ranges. One family needs about 22 font files, the cache limit of 400 from P2 covers all seven.
- **KR70.** The README gets the procedure in three lines: bump the pinned versions in `extract-kanji.mjs`, run it, run the tests. Due with every release that touches kanji content and at least twice a year.
- Noted, not acted on: 41 kana strokes over 15 units also pass when drawn backwards, which the note on phase 4 in `learning-improvements-plan.md` says does not happen.

## 7. Brief for an implementation session

What Fable hands to Opus at the start of a phase:

```
You implement phase <Pn> of docs/kanji-plan.md in this repository.

Read first: CLAUDE.md, docs/kanji-requirements.md (the KR ids below), sections 2
and 3 and the phase section of docs/kanji-plan.md, and these files: <list>.

Requirements to meet: <KR ids>.
Must not change: kana behavior, stored kana data, hiragana-quiz_2.html.
Readings and meanings come from the generated data only, never write one by hand.

Work order: pure modules with tests, then the composable, then components and styles.
Follow the code style in CLAUDE.md, match the surrounding code.

Done means: pnpm test and pnpm type-check pass, node_modules/.bin/vite build works,
and for every KR id you can name the file and the test or the screen that shows it.
Report per KR id: met, or not met and why. Say plainly what you did not verify.
Do not commit, do not push.
```
