# Review: the app after the Playground redesign

Fresh review of the app as of the `learning-phase-5` branch (commit `36b4906`). No comparison with earlier reviews, no implementation. This is the input for the next planning round.

Method: I used the app like someone who has never seen it and knows no kana. Empty storage, then the first smart session with wrong answers, typos, nonsense input, "Don't know", wrong strokes and an aborted session, then every mode, every tab and every sheet. Viewports: iPhone 375 x 812, iPad 768 x 1024 and 1024 x 768, dark and light. Positions, sizes, colors and contrast were measured in the DOM. The code was read afterwards to find the cause of what the UI showed. Nothing ran on a real device, items that depend on Safari or iOS are marked **verify on device**.

Severity: **high** shows the learner something wrong or loses their work, **med** confuses or costs effort in every session, **low** is polish.

## 1. What works well

Keep these as they are.

- **The intro card.** Stroke order animation, romaji, audio, a mnemonic, then one trace. This is the best screen in the app.
- **Stroke feedback.** "Right stroke, wrong direction", a hint after two misses, the stroke drawn for you after the third. Clear and never a dead end.
- **Feedback after an answer.** Wrong and right option colored and marked with icons, the answer, the mnemonic, one primary action in a sticky bar, Enter moves on. Uppercase and trailing spaces are accepted.
- **Results fit on one iPhone screen**, with what moved and when it comes back.
- **Light mode** carries the Playground look well: ink outlines, hard shadows, clear selected states.
- **Accessibility basics.** Focus ring for keyboard users, aria labels on icon buttons, the chart cells and the canvas, `role="status"` on feedback and toast, reduced motion is respected.
- **iPad landscape** puts the question left and the input right, nothing is cut off.
- **Leaving a session keeps the answers** and says so in a toast.

## 2. Findings

### A. Home screen and first start

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| A1 | med | Nothing explains the app on first start. The learner sees "5 new kana ready", a button "Practice now 20", a ring with "0%" and three tiles with 0. What 20 and 0% mean is a guess. | First start gets its own hero text ("Start with your first 5 kana, about 3 minutes"). Label the ring. One line under the hero on how the app works (new kana, then reviews that come back) until the first session is done. |
| A2 | med | The badge on Practice now shows the session size setting, not the session. First session: badge 20, counter 1/15, ended at 19/19. With 2 due and 2 weak kana the badge still says 20. | Show the planned number of cards, or drop the badge and keep the size in the options sheet. |
| A3 | med | The ring is the share of mastered kana out of everything in the script, 104 with dakuten and combos. Mastered needs several days, so the ring and the "mastered" tile stay at 0 for the first week while the learner practices daily. | Ring with two segments (learning and mastered) out of the kana in play, or count met kana. A beginner should see it move after the first session. |
| A4 | med | Picking rows under "Custom quiz" silently changes two other things. Smart practice only uses those rows: the hero went from "plus 3 weak, 5 new" to "2 kana due, plus 2 weak", new kana gone. The Writing tab only offers those rows. The only explanation is small print at the bottom of the Writing tab. | Smart practice ignores the custom selection, or the hero shows a removable chip "only あ行". The Writing tab always offers all rows. |
| A5 | med | "How to practice, for both kinds of quiz" is cryptic. The five mode tiles are a single choice, Timed in the same grid is a switch. The selected tile is only marked by a small check and by sinking, while the script toggle pops up and rows fill with color: three ways to say "selected" on one screen. | Say what the mode applies to ("Used by Practice now and Custom quiz"). Move Timed out of the grid into a row of its own. One selected look for tiles and rows (filled). |
| A6 | med | Row buttons are labelled in kana only (あ行, か行). Someone who cannot read kana yet cannot tell the rows apart. Combo rows show the same text twice (きゃ / きゃ). | Romaji as the small label: "a", "ka", "kya". |
| A7 | med | "to fix" ignores the script toggle while "mastered" and "learning" follow it. On Katakana: 0 mastered, 0 learning, 4 to fix (all hiragana). | Filter all three by script. |
| A8 | low | The three tiles look alike, but only "to fix" is a button. It opens the Progress tab at the top, the open errors are about 2000 px further down on an iPhone. | Scroll to the open errors. Make the other two tiles open the chart, or make "to fix" look different. |
| A9 | low | Custom quiz: the start button sits at the end of the page (1945 px on iPhone) below 26 row buttons. After picking a row at the top nothing in view changes. The count field is 27 px high with an 11 px label. | Sticky start bar while rows are picked, with the count in it. |
| A10 | low | The words change between screens: "to fix", "Open errors", "Practice errors", "Missed this round" for the same thing, "learning" and "Kana seen" for nearly the same thing. | One term per concept. |

### B. Quiz

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| B1 | med | Lookalike warnings name kana the learner has never met. The intro of い warns about り, う about ら, both weeks away in table order. In Recognize mode り and ら show up as options on day one. | In the intro only warn about a kana that is known or introduced in the same session. Keep the hint for later, when the second kana arrives. |
| B2 | med | The same kana twice in a row: the re-ask of お ("Again", 11/18) was followed directly by its planned second test (12/18). | When a re-ask lands next to another card of the same kana, move it. |
| B3 | med | A typo is recognized ("Typo? Answer: o") but still counts as wrong for the round and queues the kana again. The learner knew it. | Let the learner retype once (shake the field, "check your typing"). Only the second slip counts. |
| B4 | med | The end button (x, top left) ends the session on one tap, no question, no way back. | Undo in the toast ("Session ended. Resume"), or ask once more than a few cards are answered. |
| B5 | med | iPhone, Listen mode: "Undo" and "Show stroke" sit at 699 to 743 px, the action bar starts at 728 px. The page is 859 px in an 812 px viewport and the canvas takes no scroll gestures, so the learner has to find the gap beside it to scroll. | Size the canvas from the height that is left (`min(width, viewport height minus card, controls and bar)`). |
| B6 | low | Nonsense input is stored as a confusion. After typing "xyz" the kana sheet says "Mixed up with: xyz 1x". | Only store an answer as a confusion when it is the reading of another kana. |
| B7 | low | In Read mode the speaker button on the card plays the kana before the answer, which gives the answer away. | Disable it until the question is answered, or count it as a hint. |
| B8 | low | The counter grows without comment (15, 16, 17, 18, 19) and the progress bar jumps back. | Fine to keep, a short "+1" next to the counter when a kana is queued again explains it. |
| B9 | low | The 1 to 4 key badges on the options show on touch devices too. | Only with `(hover: hover) and (pointer: fine)`. |
| B10 | low | "Trace it" is disabled while the animation runs, without saying why. "Skip" skips the whole card, not just the trace. | Let Trace it interrupt the animation. Label: "Skip kana" or "Not now". |
| B11 | low | Write mode: after the automatic hint the "Show stroke" button disappears and Undo jumps to the middle. | Keep the button in place, disabled. |
| B12 | low | iPad portrait: card and input use the top 430 px, 590 px stay empty, the primary action is 600 px below the input. Whether the sticky bar stays visible above the on-screen keyboard is open. **verify on device** | Larger kana and a vertically centered block on tall viewports. |

### C. Results

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| C1 | high | The numbers contradict each other. Round with 5 new kana: あ right, later wrong, お wrong twice, う "Don't know". The screen says "60%", "All fixed!", "3 of 5 kana on the first try, 2 fixed on retry". Below it "Missed this round" lists 3 kana, the button says "Practice errors 3", and the home screen then shows "3 to fix". Cause: `roundSummary` (`useSession.ts:104`) only looks at the first and the last answer per kana, so right first and wrong later still counts as first try. A replayed case (first test right, second test and both re-asks wrong) gives "100%, Perfect!" with the kana in the missed list. Every session that repeats kana is affected. | One count for the whole screen. A kana that was missed at any point is not "first try". "All fixed" only when nothing is left in the error list, or say what it means ("all answered right in the end, 3 stay on your list"). |
| C2 | med | "Moved up: あ お い う え" lists all five, including the three just missed. Next to "Missed this round" this reads as a mistake. | For new kana say "Started: 5 new kana". Keep "Moved up" for reviews that were due and right. |
| C3 | low | Three full width buttons: Again, Practice errors, Home. After smart practice "Again" starts the next smart session, which the label does not say. | "Keep going" after smart practice, "Again" after a custom quiz. |

### D. Progress tab

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| D1 | high | Dark mode: "Learning" and "Not seen" cells in the kana chart are the same color to the eye, `rgb(49, 44, 102)` against `rgb(47, 44, 89)`, also in the legend. The chart cannot show where the learner stands. Light mode is fine (lilac against white). | A clearly different fill for learning in dark, or mark not seen cells with a dashed outline and dim kana. |
| D2 | med | The red dot (open error) on chart cells is missing from the legend, which only explains the yellow dot. Both dots differ by color alone, and the aria label of a cell does not mention the error. | Add it to the legend and the label. |
| D3 | med | The page is 3573 px tall on an iPhone. The chart with all 104 cells comes first, patterns, open errors and the table follow far below. | Show the main kana, fold dakuten and combos until the learner gets there. Or put open errors above the chart when there are any. |
| D4 | med | Pattern "Untested lookalikes: You missed い vs り, う vs ら but never practiced the lookalike" after the first session. The learner never chose り or ら, the answers were nonsense input and "Don't know". Its Practice button then asks about り and ら, which were never introduced. | Only raise it when both kana have been met. Change the text to what happened ("い has a lookalike you have not met: り"). |
| D5 | med | Open error rows: a bar, "3" and "40%" without headings, and a check icon at the end that marks the kana as resolved but reads like a status. | Column headings or "3 misses, 40% right". A labelled button "Resolve" or a swipe action. |
| D6 | low | Sort headers use the "↕" glyph at 11 px and do not show the active sort or its direction. | An icon from `Icon.vue` that shows the direction on the active column. |
| D7 | low | Two script filters: the toggle at the top and the All / Hiragana / Katakana chips above the table. | Let the table follow the toggle. |
| D8 | low | Four ways to start a session on one tab (pattern, errors, weak, slow). "Practice slow 2" appears after a single session. | Keep errors and patterns. Offer weak and slow only with enough data, or fold them into smart practice. |

### E. Writing tab

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| E1 | med | Only the rows picked on the Practice tab are offered (see A4). With one row picked the tab shows one chip and five kana, and the reason stands at the very bottom. | Always all rows. |
| E2 | med | iPhone: greeting, title, script toggle, row chips and kana chips come before the panel. The canvas sits at 445 to 756 px, its lower edge behind the tab bar. | Drop the greeting header on this tab, or pin the panel and scroll the pickers. Canvas sized from the remaining height (see B5). |
| E3 | low | In Write the panel hides the kana ("?"), but the selected chip right above still shows it. | Hide the glyph of the selected chip while writing, or show romaji on the chips in this view. |

### F. Sheets and settings

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| F1 | high | Progress only lives in the browser storage and there is no export or import. Safari on iOS deletes script written storage of a site after seven days without a visit unless it is installed on the home screen, so a learner who uses the app in the browser can lose everything after a week off. **verify on device** | Export and import as a file in the settings sheet. A one time hint to add the app to the home screen. |
| F2 | med | Bottom sheets do not hold the focus: Tab walks into the page behind. After closing, the focus lands on `body` instead of the button that opened the sheet. The grabber bar suggests swiping down, which does nothing. | Keep Tab inside the sheet, return focus on close. Remove the grabber or make it work. |
| F3 | low | Kana sheet: the romaji appears twice (title "お o" and a large "o"), demo, replay, stroke count, romaji and speaker are stacked one per line on the left. The Recognize / Read / Write boxes look like the pressable mode tiles. "Read" turns green at 2 right, 2 wrong, so green means tried, not good. | Kana, romaji and speaker in one head row next to the demo. Flat stat rows for the directions, colored by result. |

### G. Visual design and touch

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| G1 | med | In dark mode the Playground look is mostly gone. The hard shadows are `rgb(12, 11, 29)` on a page of about `rgb(33, 30, 62)`, cards and page differ by one shade, selected tiles are hard to spot. Light mode shows what the design is meant to be. | Lighter outline and shadow tokens for dark (or a tinted shadow), more distance between page and surface color. |
| G2 | low | Touch targets under 44 px: script toggle 40 px high, All / None / Main / Dakuten / Combos 40 px, Watch / Trace / Write 40 px, resolve button 40 px wide, count field 27 px high. | 44 px minimum, as the style rules say. |
| G3 | low | Dark mode contrast 3.98:1 for the hero eyebrow (12 px) and the hero sub line (15 px), and for the label on a selected row. | Lift to 4.5:1. |
| G4 | low | 11 px text: "Questions" label, sort icons. | 12 px minimum. |

### H. Learning logic

Read from the code after the walkthrough. "replayed" means the case was run against the pure modules in a throwaway test outside the repo, the others are traced through the code.

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| H1 | high | Write and Listen questions do not say which script is asked. The prompt is the romaji or the sound only (`QuizScreen.vue:28`). With "Both", and in error, weak and pattern practice, which pool both scripts whatever the toggle says, the learner writes か for a カ question and gets it marked wrong. | Show the script on the card ("Write the katakana for ka"). |
| H2 | high | ぢ and じ are both "ji", づ and ず both "zu" (`kana.ts:18`, same for katakana). "Write the kana for ji" and "Which kana is ji" cannot be answered for sure. `pickDistractors` does not keep a same romaji kana out of the options: ぢ stood next to じ in 350 of 2000 runs (replayed). Once picked it becomes a personal confusion and is offered every time. | Never offer a kana with the same romaji as a distractor. For write and listen accept either kana, or ask ぢ and づ only in Read. |
| H3 | med | A miss on one of the last cards is asked again right away. The re-ask position is `min(current + offset, length)` (`useSession.ts:191`), so near the end the same kana comes up to three times in a row with the answer just shown (replayed). Related: B2. | Keep at least two other cards between a miss and its re-ask, pull fill cards from the round if needed, otherwise drop the re-ask. |
| H4 | med | Wrong, then right on the re-ask seconds later, lifts the kana a box, because a miss makes it due at once (`scheduler.ts:33`). After a typo or timeout, which leave the box alone, a right re-ask can even report "Mastered" for a kana in the missed list. This is the cause of C2. | A kana missed in this session is not promoted in the same session. |
| H5 | med | In Mixed a missed kana comes back in the easiest direction: the miss sets box 0, so the re-ask is multiple choice, and that counts as "fixed on retry" (`useSession.ts:193`). | Re-ask in the direction that was missed. |
| H6 | med | "N kana due" on the hero and the badge on the Practice tab are capped at the session size (`scheduler.ts:103`). With 150 due and size 20 the home screen says "20 kana due" before and after every session, while the results screen says 130 are due. | Use the real count (`smartSummary.outlook.now`) for the headline and the badge. |
| H7 | med | "All caught up" although new kana are only held back. After two sessions on day one ten kana are in box 0 or 1, nothing is due, and the hero says all caught up with no word about the cap (replayed). Same dead end with new kana set to None on an empty profile or a script never practiced: "All caught up", 0%, nothing to start. | Say why nothing new comes ("10 kana are still settling, new ones follow once they are stable") and offer to practice those. With None on an empty script, point to the setting. |
| H8 | med | Row selection across scripts. The picked row ids are kept on a script switch. With あ行 picked and Katakana active the screen says "1 row picked" and enables Start quiz, which then answers "Pick at least one column first", and smart practice silently uses the whole table (`useSetup.ts:90`). A left over selection whose kana are all met blocks new kana for good. Adds to A4. | Count and use only rows of the active script. |
| H9 | med | The fluency timer keeps running while the app is hidden (`useQuiz.ts:186`, no visibility handling). Lock the phone in timed mode and the card times out: one more wrong answer, an open error, a re-ask. | Pause on `visibilitychange`. |
| H10 | med | Writing tab, clean writes (`useQuiz.ts:328`). Watch, then Write passes a due review with the answer seen seconds before. "Again" records another right answer each time, which lifts accuracy, pushes real errors out of the last ten answers and counts toward today. Failed writes are never recorded. A first clean write makes a kana "seen", so it gets no intro card later and counts toward the cap of ten learning kana. | Record at most one write per kana and day, and only when the kana was not watched or traced right before. Do not let a write in this tab start a kana. |
| H11 | med | "Again" on the results screen can do nothing. After weak, slow or error practice the pool may be empty on replay and the start returns without a word (`useQuiz.ts:262`). | Hide Again when the pool is empty, or fall back to smart practice. |
| H12 | med | "Due" allows four hours of slack, the texts do not (`scheduler.ts:13` against `KanaSheet.vue:71`). A kana counts as due and has a due dot in the chart while its sheet says "Next review in 3 h". | One function for both. |
| H13 | low | The plan on the home screen goes stale while the app stays open: the computeds read the clock without a time dependency (`useQuiz.ts:48`). The hero can say "All caught up" while the session it starts contains kana that became due, and "N today" and the streak stay on yesterday after midnight. | Refresh on `visibilitychange` and once a minute. |
| H14 | low | Streak across a clock change (`progress.ts:16` steps back 24 h in milliseconds). In the hour after spring forward a two day streak shows 1, in the hour before midnight after fall back it counts the Sunday twice (replayed). | Step by calendar day. |
| H15 | low | "Practice this kana" for a kana without lookalikes is the same question six times in a row. A single new kana with no reviews gives intro, test, test back to back. | Fill with known kana. |
| H16 | low | `lookalikesOf` returns the first group only (`lookalikes.ts:37`): は is in two groups and misses け, コ misses ロ. | Merge all groups a kana is in. |
| H17 | low | Small ones: the error bar scale uses the first row instead of the largest count (`useStats.ts:59`), "1 kana are due now" (`ResultsScreen.vue:26`), count "0" shows "0 questions" but uses all kana (`useSetup.ts:73`), a stale auto advance timer can skip the first card of a session started within about a second of leaving one (`useQuiz.ts:301`), Kunrei answers given as a wrong answer are not resolved to a kana so there is no side by side explanation. | Fix in passing. |

Checked and sound: intro cards are never scored, a re-ask is always asked before the session ends and at most twice, the plan on the hero and the session come from the same picker, promotion only happens when a kana is due and once per session, a timeout cannot fire on an answered card or after leaving, resolving and resetting keep badges, chart and list in step.

### I. Code, build and PWA

`pnpm type-check` is clean, 85 tests pass, the build runs. No dead CSS classes apart from one, every `:hover` rule sits inside `@media (hover: hover)`, no listener or timer leaks, all icons and storage keys are in use.

| # | Sev | Finding | Recommendation |
|---|---|---|---|
| I1 | high | The draw canvas of the first card can be judged against the previous kana. `StrokeCanvas` is keyed by the question index only (`QuizScreen.vue:223`) and `QuizScreen` is never unmounted, so leaving a Write or Listen session on its first card and starting another reuses the component. Reproduced: six starts in a row, the same svg element each time with a different kana. The reference strokes are sampled once in `onMounted` (`StrokeCanvas.vue:50`) and the miss counters persist, so the new kana is checked against the old strokes and the result goes into the stats. One card sessions hit it too. | Key by session and index (`startedAt` plus `current`). |
| I2 | med | The font stylesheet in `index.html:17` is the largest resource of the app: 7 families, 16 weights, 1.37 MB of CSS (359 kB compressed, 1503 `@font-face` rules), render blocking on every start. Kana are only ever drawn at weight 700, and five of the families are only needed when a font is picked in the settings. Nunito plus Zen Maru Gothic 700 alone is 30 kB compressed. | Load Nunito and the chosen kana font at 700. Load the other picker fonts when the settings sheet opens. |
| I3 | med | The eruda debug console is precached for every user: 506 kB of the 773 KiB precache (`vite.config.js:11`, loaded only with `?eruda` in `main.ts:10`). | `globIgnores: ['**/eruda-*.js']`. |
| I4 | med | `apple-mobile-web-app-status-bar-style` is `black-translucent` (`index.html:10`), which draws white status bar text. With the light theme that is white on cream in the installed app. **verify on device** | `default`, or keep translucent only for dark. |
| I5 | med | Offline is patchy. Audio clips are fetched from another site's server (files.tofugu.com, `audio.ts:1`) and never cached: the app depends on that host staying up and allowing it. Offline it falls back to speech synthesis, and `speak()` reports success even without a Japanese voice, so Listen can be silent without the "tap to hear" state. Kana fonts are cached slice by slice as they are used, with room for 20 files, so offline some kana fall back to the system font. | Bundle the clips (71 short files) and precache them. Report a missing voice as a failed play. Raise the font cache limit or self host the one default kana font. |
| I6 | med | Manifest and icons still show the old dark and gold design with a serif あ (`public/icon.svg`, `apple-touch-icon.png`, inline favicon). The manifest has no 192 or 512 px PNG and no maskable icon, and its `theme_color` differs from the meta tags. | New icon in the Playground colors, PNG 192 and 512, one maskable. |
| I7 | med | A waiting update reloads the app at once whenever the setup screen is showing (`App.vue:17`). That includes the Writing tab in the middle of a drawing and any open sheet. | Apply at once only on the Practice tab with no sheet open, otherwise show the banner. |
| I8 | low | Rule deviations in `styles.css` and templates: `.chart-cell` is pressable but not in the shared pressable block, glyphs instead of `Icon` (`ProgressTab.vue:24`, `StrokeCanvas.vue:147` with logic that tests `startsWith('✓')`, `StrokesTab.vue:137`), raw colors in seven places (lines 332, 347, 449, 508, 509, 1119, 1211), update banner button 36 px high. The focus ring in dark mode has about 2.6:1 against the page. Kosugi Maru only exists in weight 400 and is drawn faux bold. | Fix in passing. A lighter focus ring token for dark. |
| I9 | low | Leftovers of the old tabs and of kana without stroke data: unused context keys (`headerTitle`, `scriptsInPlay`, `answerLog`, `roundSummary`, `notify`), the `StatsSummary` type, `totalErrors` and `avgTime`, the `romaji-opt` branch and style, the `canDraw` and `hasStrokes` fallbacks (a test guarantees stroke data for every kana), names like `errorTabCount`. `README.md` still lists `ErrorsTab.vue` and `StatsTab.vue`. `App.vue:26` deletes a cache that no longer exists and throws without https (iPad over LAN). | Delete. |
| I10 | low | Small duplicates: `at()` and `polyline()` in three components, accuracy percent in three places, the "seen" check in seven, "10 or more are still shaky" written out twice next to `MAX_LEARNING`. | Move the stroke helpers to `strokeGlyphs.ts`, one `seen()` and one `accuracy()` in `format.ts`, build the text from the constant. |
| I11 | low | The number keys pick an answer even with Cmd or Ctrl held and on key repeat (`QuizScreen.vue:105`). After one pencil stroke finger drawing stays off until reload. | Ignore modified and repeated keys. Reset the pencil flag per session. |

## 3. Proposed plan

Six phases, each shippable on its own, ordered by harm to the learner first and effort second. 71 findings, 6 of them high.

### Phase 1: numbers and judgments the learner can trust (small)

- C1 one count on the results screen, C2 and H4 no promotion and no "Moved up" for a kana missed in the same session.
- I1 canvas key per session.
- H1 script on write and listen cards, H2 same romaji kana.
- A2 and H6 real card and due counts, A7 script filter for "to fix", H8 row selection per script.
- D1 chart colors in dark mode.

Status: done. Decisions taken on the way:

- C1: the title for "nothing left open" is now "Got there!" and the detail says "right on retry", so the word "fixed" no longer clashes with "to fix" on the home screen.
- H2: a kana with the same romaji is never a distractor. Write and listen cards for ぢ and づ carry a note ("not じ, the other one") instead of accepting either kana.
- A7: not only the tile but the open error list, the Progress badge, "Mark all resolved" and error practice follow the script toggle.
- A2: the badge shows the number of cards the session starts with, intro cards included, so it matches the counter.
- Also fixed in passing: the error bar scale and "1 kana are due now" from H17.

### Phase 2: first start and a home screen that explains itself (medium)

- A1 first start text, A3 a ring that moves, H7 honest "caught up" texts.
- A4 and E1 uncouple the row selection from smart practice and the Writing tab.
- A5 mode tiles and the Timed switch, A6 romaji on the row buttons, A10 one word per concept.
- B1 and D4 lookalike warnings and patterns only for kana the learner has met.

Status: done. Decisions taken on the way:

- A4: the coupling stays but shows. While rows are picked the hero says "New kana only from the rows picked below: a, ka" with a "Use all rows" button. E1: the Writing tab always lists every row.
- A3: the ring counts kana seen out of the table ("5 of 104"), one arc. Mastered stays in the tile below.
- A5: a selected mode tile is filled like a selected row. Timed is a switch row under the grid, the odd fifth tile fills its row.
- A10: the tile says "errors", the other places already did.
- H7: `newBlocked` gives the reason no new kana come (`off`, `rows`, `cap`) and the hero prints it. An empty script with new kana switched off says "Nothing to practice yet".
- D4: the untested lookalikes pattern waits until the row of the unseen lookalike has been started, and no longer claims a mix-up that did not happen.

### Phase 3: session flow (medium)

- B2 and H3 spacing of re-asks, H5 re-ask in the missed direction.
- B3 one retry after a typo, B4 undo for an ended session.
- B5 and E2 canvas sized from the height that is left on phones.
- H9 pause the timer in the background, H10 rules for clean writes, H11 no dead Again.
- B6, B7, B9, B10, B11 in passing.

Status: done. Decisions taken on the way:

- H3: a miss close to the end gets up to two other kana of the round in front of its re-ask, so the session grows by up to three cards. With no other kana in the round the re-ask is dropped.
- B3: the first typo on a card counts nothing and shows "Looks like a typo. Fix it and check again.", the second counts as before.
- B4: the toast after leaving has a Resume button for seven seconds. Leaving without an answer shows it too.
- B5: the canvas height on phones comes from fixed numbers per card type (`--draw-chrome`), not from measuring. On a 667 px high phone the listen card also gets more compact.
- E2: Trace and Write scroll the stage to the top of the screen, the header stays as it is.
- H10: a write counts once per kana and day, a kana that is not in practice yet is not stored, and a write right after seeing the kana is stored but cannot move it up.
- B10 was half wrong: "Trace it" was never disabled, the screenshot caught it mid transition. The skip button now says "Skip intro" or "Skip tracing".
- Not checked in the browser: H11 (Again with an empty pool), it needs a state that is tedious to build by hand.

### Phase 4: progress tab and sheets (medium)

- D3 shorter page with errors in reach, A8 "to fix" jumps to them.
- D2 legend, D5 readable error rows, D6 sort icons, D7 one script filter, D8 fewer starts.
- F2 focus handling in sheets, F3 kana sheet layout.

### Phase 5: data safety, loading and offline (medium)

- F1 export and import, hint to install.
- I2 fonts, I3 eruda out of the precache.
- I5 bundled audio, I4 status bar, I6 icons and manifest, I7 update timing.
- Check on an iPhone and an iPad: F1, I4, B12, audio in Listen.

### Phase 6: dark mode look and cleanup (small)

- G1 shadow and surface tokens for dark, G2 to G4, I8.
- I9 leftovers, I10 duplicates, I11, H12 to H17, remaining low findings.

## 4. Measurements

DOM `getBoundingClientRect` in the browser emulation, no real device.

| What | iPhone 375 x 812 | iPad 768 x 1024 |
|---|---|---|
| Practice tab height | 2128 px | 1653 px |
| Custom quiz start button, top edge | 1945 px | about 1500 px |
| Progress tab height (5 kana seen) | 3573 px | not measured |
| Writing tab, canvas in Write view | 445 to 756 px, tab bar from about 748 px | not measured |
| Listen card, canvas | 331 to 743 px | not measured |
| Listen card, Undo and Show stroke | 699 to 743 px, action bar from 728 px | not measured |
| Question card plus input, Read | 78 to 356 px | 90 to 431 px |
| Results screen | fits in 812 px | not measured |

| Build | Size | gzip |
|---|---|---|
| App JS | 227 kB | 82 kB |
| App CSS | 50 kB | 10 kB |
| eruda chunk | 506 kB | 161 kB |
| Precache | 9 entries, 773 KiB | |
| Google Fonts stylesheet | 1368 kB | 359 kB |

## 5. Not covered

- Real Safari behaviour on iPhone and iPad: audio unlock, palm rejection, on-screen keyboard and the sticky bar, storage eviction, status bar.
- VoiceOver. The labels were read in the code, not heard.
- Katakana, dakuten and combos were only spot checked, the walkthrough stayed in the first hiragana rows.
