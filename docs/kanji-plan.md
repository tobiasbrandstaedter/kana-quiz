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

Needed for the on and kun labels, for "another reading of the same kanji" as a wrong option (KR17) and for the special flag (KD14). P1 first looks at JmdictFurigana, an open data set that has exactly these splits for JMdict entries (licence to be checked). If it can't be used, the script cuts the reading itself: each kanji gets one of its KANJIDIC2 readings, allowing voicing and a small っ at the joints, and a word where no cut works is special.

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

Opus. The chunk and its loading, Kanji in the script switch with the due dot, kanji stats, intro card, `meaning` and `recognize`, smart practice and custom quiz over all kanji, quiz screen, results screen. New card styles first: a keyword list in the choices, kanji in the choices at a size where 土 and 士 differ at 375px.

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
| P0 | Measure the list, stroke check, fonts, size, number words, licence, voice | open |
| P1 | Data script, course content, checks | open |
| P2 | Groundwork, no visible change | open |
| P3a | K1 practice | open |
| P3b | K1 the rest | open |
| P4a | K2 words | open |
| P4b | K2 typing and sound | open |
| P5 | K3 groups | open |
| P6 | K4 patterns | open |
| P7 | K5 writing | open, depends on P0 |

## 6. Results of P0

Empty until P0 has run.

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
