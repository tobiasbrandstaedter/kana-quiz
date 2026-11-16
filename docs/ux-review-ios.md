# UX review: learning on iOS and iPad

Functional review of the app as of the `learning-phase-5` branch, from the point of view of someone learning kana on an iPad or iPhone. No implementation, this is the input for the next planning round.

Method: read every component and composable, then walked through all flows in the browser at iPad portrait (768 x 1024) and iPhone (375 x 812), measuring element positions with the DOM. Nothing was run on a real device. Items that depend on Safari or iOS behaviour are marked **verify on device**.

Severity: **H** blocks or clearly hurts learning on a tablet, **M** friction every session, **L** polish.

## 1. What already works well (keep as is)

The learning core is strong and ahead of most kana apps:

- **Leitner scheduling with honest promotion.** A kana only moves up when it was due, so hammering it in one sitting does not fake mastery. Typos and timeouts leave the box alone. This is the right call.
- **Smart practice.** Due first, then weak, then at most five new kana, held back while ten or more are shaky. Intro card, test shortly after, test again later. Textbook spacing inside a session.
- **Re-ask within the session** three to six questions later. Cheap and effective.
- **Error explanation** with "yours vs correct" side by side plus the lookalike hint. The hints in `lookalikes.ts` are concrete and visual ("ぬ ends in a loop, め does not"), which is what a learner needs at the moment of confusion.
- **Targeted distractors** (own confusions, then lookalikes, then same row or vowel). Choice mode is a real test, not a lottery.
- **Romaji tolerance** (Kunrei, nn, typing habits) and the typo filter. No false errors polluting the data.
- **Stroke order ladder** Watch, Trace, Write, with per stroke feedback, hint after two misses, auto draw after three. The matcher checks order and direction on purpose. Drawing thumbnails on the results screen are a great touch.
- **Pattern cards** with a one tap practice button, on results and in stats.
- **Progress bar per column** and the error tracker that empties itself once a kana is mastered again.
- **Platform basics**: 44 px touch targets almost everywhere, safe area insets left, right and bottom, PWA with update banner, `prefers-reduced-motion`, aria labels on the audio button, canvas and progress bar, `touch-action: none` on the canvas, `autocapitalize`/`autocorrect` off on the romaji field.
- **Fluency mode** that counts a timeout as wrong for the session but not for the schedule.

## 2. Findings

### 2.1 Quiz flow

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| F1 | H | After a wrong answer the NEXT button sits below the fold on iPad portrait (top edge at 1044 px in a 1024 px viewport) and on iPhone. With the keyboard open it is further away. There is no keyboard way to continue: Enter is ignored once answered. Every mistake costs a scroll and a hunt. | Sticky action bar at the bottom of the quiz screen holding CHECK / NEXT / GOT IT. Enter (and the iOS return key) advances once answered. Optional: tap anywhere on the feedback block to continue. |
| F2 | H | The result score counts re-asks as questions. One kana missed once and then answered right shows "50 %, KEEP STUDYING". The learner did exactly the right thing and gets told off. | Score by unique kana of the round: "4 of 5 kana, 1 needed a second try". Keep the raw count in small print if wanted. |
| F3 | M | Six ways to start a session (Smart START, START QUIZ, PRACTICE ERRORS twice, PRACTICE WEAK, PRACTICE SLOW, pattern PRACTICE) with no hierarchy. Smart practice silently depends on the mode and count chosen further down ("uses the settings below"). | One primary call to action at the top: "Practice now" (smart). Everything else secondary. Smart practice gets its own direction choice on the card (Read / Recognize / Write / Mixed) instead of the hidden coupling. |
| F4 | M | Results screen ends the session with no outlook. Nothing says what was learned, what comes back tomorrow, or how many kana are mastered now. | Add a "what changed" block: kana moved up a box, kana that fell back, next due count and time. This is the motivational anchor of a spaced repetition app. |
| F5 | M | In choice mode the wrong option is already red and the right one green, then the explanation repeats both kana below. Redundant and pushes NEXT down (see F1). | Keep the option colors, shrink the explanation to the one line hint plus the romaji of the chosen kana. |
| F6 | L | Progress "3 / 15" silently becomes "3 / 16" on a re-ask. | Fine to keep, but a small "+1" flash or "re-ask" tag on the re-asked question makes it understandable. |
| F7 | L | HOME is a 65 x 44 px button with 11 px text in the corner. Easy to miss, and it leaves the session without a hint that progress is kept. | Larger "End" button, and a one line note on the setup screen "session ended, N answers saved" or a confirm sheet. |

### 2.2 Setup screen and navigation

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| S1 | H | The setup page is 2264 px tall on iPad and 3337 px on iPhone. START QUIZ is at the very bottom. Header (96 px title) plus font picker take the first 480 px on every tab, although the font is a one time preference. | Compact header (title 40 px, one line). Move the font picker and reset actions into a settings sheet (gear icon). Make START sticky at the bottom while the practice tab is visible, or show a summary card at the top ("Hiragana, 10 columns, Read, 20 questions, START") with the detail selectors below it. |
| S2 | M | Tab badges mean four different things: selected columns, kana in the stroke list, open errors, kana seen. The learner reads "10, 46, 3, 3" and cannot tell what they are. | Keep a badge only where it is actionable (errors due, reviews due). Drop the others or label them. |
| S3 | M | Column progress (mastered / learning / due) is only reachable through the `title` tooltip, which does not exist on touch. On iPad the learner sees a thin bar and a red dot with no legend. | Legend row under the selector ("green mastered, purple learning, red has errors") and a per column tap and hold or info sheet. Better: see P1, a kana chart. |
| S4 | M | Smart practice with no selection pulls new kana from the whole table in table order, with selection from the selection. The two behaviours are explained in a 12 px note. | Show the plan explicitly on the card: "Next new: か き く け こ". Let the learner change the number of new kana per session (0, 3, 5). |
| S5 | L | "Nothing to practice right now" with no reason or next time. | "All caught up. 12 kana due tomorrow, 3 on Friday. Practice anyway?" |
| S6 | L | Native `alert()` for empty pools ("No weak kana in this filter!") and `confirm()` for resets. In a standalone PWA on iOS these are bare system dialogs. | Inline empty states and disabled buttons; a bottom sheet for the two destructive confirms. |

### 2.3 Drawing on iPad

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| D1 | H | The draw canvas is 300 x 300 px in the quiz and 240 x 240 px on the Stroke Order tab, on a screen that is 768 px wide. Finger writing is cramped and Apple Pencil precision is wasted. The rest of the screen is empty. | Size the canvas from the viewport: `min(80vw, 60vh, 520px)` portrait. On iPad landscape put the prompt (romaji, audio, stroke counter) left and the canvas right. Keep 300 px as the minimum on phones. |
| D2 | H | Every touch is judged as a stroke. A palm, a knuckle or an accidental tap while holding the iPad counts as a miss, after two misses a hint appears and the kana is lost. There is no undo. **verify on device** | Ignore strokes shorter than a few units (a tap). While a `pen` pointer has been seen in the session, ignore `touch` pointers (basic palm rejection). Add "undo last stroke" that does not count as an error if the stroke was accepted, and a "clear and retry this kana" that counts as one miss. |
| D3 | M | After a correct drawing the app advances after 900 ms. The learner barely sees the finished kana against the reference. After a wrong one it waits for NEXT (below the fold, F1). | Show the reference over the ink for a moment with a "✓ clean" or "order: stroke 2 before 1" overlay, then NEXT in the sticky bar. Let the learner tap to continue early. |
| D4 | M | Trace and Write on the Stroke Order tab record nothing. The scheduler and the stats never learn that the kana was written cleanly five times, and the kana picker shows no state. | Record a clean Write as a `draw` answer (not Trace). Mark kana in the picker: never written, written with help, written cleanly. |
| D5 | M | The kana picker on the Stroke Order tab is ten rows of 48 px buttons below the panel, so picking a kana means scrolling down and the panel scrolls back up. Prev / Next cover the common case but not "jump to ふ". | Horizontal, scrollable row picker (あ行 か行 ...) plus the five kana of that row under the panel. Or put the picker in a collapsible sheet. |
| D6 | L | "SHOW STROKE 2" is the only help in recall mode and it immediately costs the kana. There is no "I don't know this one" that skips honestly. | Add "Don't know" (counts as wrong, shows the animation, moves on) next to the hint button. |
| D7 | L | Combo kana layout (base plus small kana at 75 units) is good, but the canvas gets wider (`--w` 1.7) and on iPhone the two glyph canvas is 320 px wide for two glyphs, so each glyph is tiny. | Allow the combo canvas to take the full width on phones. |

### 2.4 Audio

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| A1 | H | Listen → Write plays the sound from a `watch` on the current question, which after an auto advance runs from a timer, not from a user gesture. Safari on iOS only lets a fresh `Audio` element play from a gesture, so from the second question on the learner is likely to see "?" and hear nothing. The app also deletes the `kana-audio` cache on start, and the files come from an external host, so the PWA has no sound offline. **verify on device** | Bundle the 71 clips (or generate them once) and cache them in the service worker. Unlock audio on the first tap of the session and reuse one `Audio` element (or Web Audio) for every play. If a play is refused, show a clear "tap to hear" state on the card instead of a silent "?". |
| A2 | M | The speaker is an 18 px icon in the corner of the question card. In listen mode it is the question and should dominate. | In listen mode: a large replay button centered where the kana would be, with a short animation while playing. Elsewhere the small icon is fine. |
| A3 | L | iOS silent switch mutes HTML audio. Learners will think the app is broken. | One time hint under the listen card: "no sound? check the silent switch". |

### 2.5 iOS platform details

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| P1 | H | `apple-mobile-web-app-status-bar-style` is `black-translucent`, so in standalone mode the page runs under the status bar, but the top padding is a fixed 40 px with no `env(safe-area-inset-top)`. On an iPhone with a notch (47 to 59 pt status bar) the title and the HOME button in the quiz sit under the clock. iPad is borderline (24 pt). **verify on device** | `padding-top: max(40px, env(safe-area-inset-top) + 12px)` on the container, and the same for the sticky bars from F1. |
| P2 | M | No `touch-action: manipulation` on buttons. Fast repeated taps in choice mode (answer, NEXT, answer) can trigger Safari's double tap zoom. **verify on device** | `button, .option-btn, .col-btn { touch-action: manipulation; }` |
| P3 | M | Hover styles on nearly every button are not guarded by `@media (hover: hover)` (only `.audio-btn` is). On iOS the hover state sticks after a tap, so buttons look selected until the next tap elsewhere. | Wrap all `:hover` rules in `@media (hover: hover)`, keep `:active` for touch feedback. |
| P4 | M | The 200 px kana in the question card and the big result score are selectable. A long press (common while thinking) opens the iOS selection callout. | `user-select: none; -webkit-user-select: none; -webkit-touch-callout: none` on the question card, options, results and stroke demo. |
| P5 | M | iPad landscape with the keyboard open leaves roughly 350 px. The 200 px kana plus the input do not fit, Safari scrolls the input into view and the kana is gone. | Landscape layout for the quiz: question card left, input or options right. Shrink the kana to 140 px when the visual viewport height drops below 500 px (`visualViewport` resize). |
| P6 | L | Romaji field has no `enterkeyhint`, so the iOS key says "return" instead of "go" or "done". | `enterkeyhint="go"` on the field, `inputmode="latin"` is default and fine. |
| P7 | L | Stats table sort headers are 20 px high. | 44 px tap rows for the headers, or sort chips above the table. |
| P8 | L | Smallest texts are 11 to 12 px (smart note, stroke count, HOME, time badges). On an iPad held at arm's length that is hard to read. | Minimum 14 px for anything that carries information. |
| P9 | L | Dark theme only, with dim text at `#888899` on `#12121a`. Outdoors on an iPad this is low contrast. | Offer a light theme via `prefers-color-scheme`, and lift the dim text to at least 4.5:1. |

### 2.6 Learning design

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| L1 | H | Choice distractors come from the full kana table. A learner who selected only the main rows is asked "mi" with び and じ as options, kana they have never met. For a beginner this is noise, not a test. | Build distractors from the kana the learner has seen (stats) plus the selection first, fall back to the full table only when that pool is too small. Lookalikes can still be added when they are in the seen set. |
| L2 | H | The intro card shows the animation, the romaji and the lookalike hint, then GOT IT. Nothing is done with the new kana on first contact. Writing or tracing once on first contact is the strongest anchor the app has, and the canvas already exists. | Intro card as a two step: watch (animation), then trace once (guide visible, not scored). GOT IT only after the trace. Skippable for learners who do not want to write. |
| L3 | M | The Leitner box is per kana, not per direction. A kana can reach "mastered" through choice questions only and never be typed or written. The direction gap pattern catches it late. | Promote only when the due review was answered in the session's direction, and prefer a different direction than last time when the kana is due again (recognize, then read, then write). Shown to the learner as three small dots per kana. |
| L4 | M | No mnemonic. The lookalike hints are the only memory aid. Most beginners rely on a picture or phrase for the first days ("あ looks like an antenna on a TV"). | Optional one line mnemonic per kana in the intro card and in the explanation after a miss. Text only, no images needed. |
| L5 | M | New kana come in table order (あ い う え お か ...). That is fine for hiragana but does not mix in the lookalike early enough: あ is introduced, お comes three cards later as a separate new kana with the same warning. | Introduce lookalike pairs together when both are new: one card "あ and お", with the difference highlighted, then test both. |
| L6 | L | Mixed mode picks a random direction per question. For a kana in box 0 that may mean a draw question before it has ever been recognized. | Direction by box: box 0 and 1 recognize, box 2 read, box 3 and up write, mixed only from box 2. |
| L7 | L | Fluency limits are fixed (3.5 s typed, 3 s choice). A fast learner never feels the clock, a slow one always fails. | Set the limit from the learner's own median times the pattern already computes (for example 1.5 x median, floor 2 s). |

### 2.7 Progress and motivation

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| M1 | H | There is no picture of the whole journey. The column bars show seen and mastered per column, but a learner cannot see "I know 31 of 46 hiragana, these 5 are shaky, these 10 are untouched" at a glance. This is the single most used screen in every successful kana app. | A kana chart (gojūon grid) per script, each cell colored by Leitner box, due cells marked. Tap a cell for details, stroke demo and audio. Make it the landing content of the Practice tab, replacing the column selector's role as "map" (the selector can stay for choosing). |
| M2 | M | No streak, no daily target, no "practiced today". | Small header line: "Day 4 in a row, 12 reviews done today, 8 left". Stored in localStorage, no backend. |
| M3 | M | Stats show accuracy, seen, errors and time, but never the Leitner box or the next due date, which are the model the app actually runs on. | Add box and "due in" columns, and a per kana sheet with its confusions and per direction counts (the data is already there). |
| M4 | L | Results: missed kana are static. The natural next step (see the stroke order, hear it) needs a trip to another tab. | Tap a missed kana on the results screen to open the stroke demo and audio inline. |

### 2.8 Errors and stats tabs

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| E1 | H | "CLEAR ALL" on the Errors tab asks "Clear all error history?" and then runs the same `clearAll` as RESET STATS: all stats, boxes and the answer log are gone. The ✕ per row deletes the whole stat entry of that kana including its box. | "Clear errors" should only drop the error flags (confusions, lastWrong) and keep boxes and counts. ✕ per row becomes "mark as resolved". One real reset lives in the settings sheet with a typed confirm. |
| E2 | L | Errors and Statistics tabs overlap: both list kana with accuracy and both start practice. | Merge into one "Progress" tab: the kana chart on top (M1), patterns below, then the table with a filter "errors only". |

## 3. Proposed plan

Four phases, each shippable on its own. Ordered by learning impact per effort, with the iOS blockers first.

### Phase A: iOS and iPad blockers (small)

- F1 sticky action bar with CHECK / NEXT / GOT IT, Enter advances after answering.
- P1 safe area top padding, P2 `touch-action: manipulation`, P3 hover guards, P4 no text selection on the quiz, P6 `enterkeyhint`.
- D1 responsive canvas size, D2 tap filter and basic palm rejection, undo last stroke.
- A1 bundled audio, one unlocked element, visible fallback state. Verify listen mode on a real iPad and iPhone.
- E1 clear errors without wiping progress.

### Phase B: quiz flow and setup (medium)

- S1 compact header, font picker and resets into a settings sheet, START within reach.
- F2 unique kana score, F4 "what changed" block on results, F5 slimmer explanation in choice mode.
- F3 one primary "Practice now" with its own direction choice, the rest secondary.
- D3 pause on a finished drawing with the reference overlay.
- S6 inline empty states, bottom sheets instead of `alert` / `confirm`.
- P5 landscape layout for the quiz on iPad.

### Phase C: progress map and the stroke tab (medium)

- M1 kana chart colored by box as the home of the Practice tab, with tap for detail (stroke demo, audio, confusions).
- D4 record clean writes from the Stroke Order tab, state marks in the picker, D5 row based picker.
- M2 streak and today line, M3 box and due columns in stats, E2 merge errors into the progress tab.
- S2 drop or label the tab badges, S3 legend for the column bars.

### Phase D: learning design (medium to large)

- L1 distractors from the seen pool first.
- L2 intro card with a trace step.
- L3 per direction promotion and direction rotation on reviews, L6 direction by box.
- L4 one line mnemonics (needs content for 142 kana, can be rolled out in rows).
- L5 lookalike pairs introduced together.
- L7 adaptive fluency limit, M4 inline stroke demo on results.

## 4. Measurements used above

Taken in the browser emulation, DOM `getBoundingClientRect`, no real device.

| Screen | iPad 768 x 1024 | iPhone 375 x 812 |
|---|---|---|
| Setup page height | 2264 px | 3337 px |
| START QUIZ top edge | about 2160 px | 3231 px |
| First content after header and font picker | about 480 px | about 500 px |
| NEXT after a wrong typed answer, top edge | 1044 px (below fold) | below fold |
| Draw canvas (quiz) | 300 x 300 px | 300 x 300 px |
| Draw canvas (Stroke Order tab) | 240 x 240 px | up to 320 px |
| Stats sort header height | 20 px | 20 px |
| Choice option button | 357 x 145 px | full width |

## 5. Not in scope

- Visual redesign. The look is distinctive and consistent; the findings above are about flow, size and feedback.
- Free handwriting recognition, as already decided in the learning plan.
- Accounts, sync, backend. Everything stays in localStorage.
