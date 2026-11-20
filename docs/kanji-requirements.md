# Kanji for JLPT N5: requirements

What the kanji part of the app has to do, and why. Nothing is implemented yet. The technical design and the agent workflow are in `kanji-plan.md`.

The decisions in here were taken on 2026-11-20 without further questions to the owner of the app, from the view of a beginner in Japanese, with learning effect and ease of use ahead of everything else. Decisions carry an id (KD) and a reason so they can be challenged later. Requirements carry an id (KR) so a review can tick them off one by one. The ids are stable, new ones are added at the end, so they are not in reading order everywhere.

This is the second version. The first was reviewed by an independent agent as a teacher of beginners and as a requirements reviewer, and what it found is worked in: number words and dates, asking for the meaning of words, the card budget of a session, word identity, the release table.

Japanese examples in this file are illustrations. The data phase checks every one of them against the sources before it becomes content (KD15).

## 1. The learner

- Has learned hiragana with this app or is about to finish. Katakana may still be in progress.
- Knows little or no vocabulary and no grammar.
- Practices on a phone, a few minutes at a time, often offline (installed PWA on iOS).
- Wants to pass JLPT N5 or just read the first real words. Reads the English UI as a second language.

What follows from that:

- Nothing may assume a word is known. Every word the app asks for is taught first, and its meaning is asked for too.
- One new thing per card. A kanji with four readings on one card is where beginners give up.
- Readings are written in hiragana, so kanji practice keeps the kana alive.
- Meanings are short English keywords, one up front.

## 2. Goal

The JLPT N5 tests kanji in two tasks of the vocabulary section: 漢字読み (a word in kanji is given, pick its reading in hiragana) and 表記 (a word in hiragana is given, pick the right way to write it). Neither asks for handwriting, both ask for words, not for single kanji. That sets the goals:

| | The learner can | JLPT task |
|---|---|---|
| G1 | say what each N5 kanji means on sight | base for both |
| G2 | read common N5 words written with these kanji, numbers with counters and dates included | 漢字読み |
| G3 | pick the right kanji for a word given in hiragana, lookalikes included | 表記 |
| G4 | write each kanji in the right stroke order | none, it supports G1 and G3 |

G1 to G3 decide what counts as progress. G4 is offered and encouraged but never blocks anything.

### Not in scope

- A vocabulary trainer for all N5 words (about 700). Words are in the app because readings live in words, not to cover the word list.
- Grammar, example sentences, listening comprehension.
- Kanji beyond N5.
- Drilling on and kun readings as lists detached from words.
- A course on radicals. A kanji can point to simpler kanji it is built from, nothing more.
- Free handwriting recognition without stroke order, same as for kana.
- A placement test or "I know this already" shortcuts.
- Meanings in German or any second UI language.
- Pitch accent.
- Timed mode for kanji in the first releases (see KD16).

## 3. Decisions

### KD1: the set is the former level 4 list plus 曜

JLPT has published no kanji lists since 2010, on purpose. Two lists are in use: the kanji of the former level 4 (the level N5 replaced), carried as a tag in KANJIDIC2, and a shorter community list of 79 that jisho.org uses. The shorter one is a subset of the longer one. The app uses the longer one. A first count through a third party copy gave 102 kanji, 103 is the number usually quoted (新 is the likely one missing from that count), the data script counts them from KANJIDIC2 itself and that count is what the app shows.

The 23 kanji found only in the longer list: 口 手 目 立 分 少 古 耳 花 足 会 多 社 言 空 安 店 週 魚 買 道 飲 駅.

Why the longer list: those are everyday kanji whose words are N5 vocabulary (口, 手, 安い, 買う, 飲む, 駅), so a learner meets them in any N5 material. Four of them (口, 目, 耳, 言) are the building blocks of kanji in the short list (名, 見, 聞, 語), and teaching the whole before its parts makes no sense. They cost about a week at the planned pace. The list also comes straight out of the source file, so no hand typed list has to be trusted.

Why 曜 on top: it is in neither list, but the seven days of the week are N5 words and can't be written without it, and a learner who can't read a calendar has not learned the kanji for sun, moon and fire in any useful way. One kanji buys seven words that are used every day.

The app says where the list comes from, it does not claim to be official.

### KD2: meanings in English

The whole UI is English and the source (KANJIDIC2) has English meanings. German would need a second source and a second review of every entry for little gain.

### KD3: two kinds of things to learn, kanji and words

A kanji is learned for its meaning and its shape. A word is learned for its reading and its meaning. Each is scheduled on its own.

Why: knowing that 日 means "day" and being able to read 今日 are different pieces of knowledge, and they are forgotten at different speeds. With the kanji as the only unit, a missed reading would throw the whole kanji back, and the app could not tell the learner "you know 日, you can't read 今日 yet". That sentence is the most useful feedback the app can give here.

### KD4: readings are learned through words only

There is no question "what are the readings of 日". Each kanji brings a few N5 words that show its important readings (日: 日, 毎日, 日本). The kanji sheet lists the readings as they appear in those words.

Why: a reading without a word can't be used and doesn't stick. Which reading applies is a property of the word, and the JLPT asks for words.

### KD5: hiragana, no romaji

Readings are shown in hiragana everywhere, on readings as well (dictionaries print those in katakana). Romaji is not shown in the kanji part.

Why: the learner comes from the kana part and should read kana from now on. Hiragana only means katakana doesn't have to be finished to start. The learner still types on a Latin keyboard, see KR20.

### KD6: meanings by choice, readings by choice first and typing later

Meaning questions are multiple choice in both directions. Reading questions start as multiple choice and move to typing once the word has left the first boxes.

Why: typing an English meaning brings synonyms, spelling and a foreign language into the answer ("tall" or "high" or "expensive" for 高), and every false "wrong" pollutes the statistics. Choice with well picked wrong options avoids that. Readings have exactly one right spelling in kana, so they can be typed, and typing is recall, which sticks better than picking.

### KD7: themed sets, building blocks first

The kanji come in sets of four to eight with a theme a beginner can name (numbers, days and elements, people, school, directions). Inside the order two rules win over the theme: a kanji that is built from another kanji of the set comes after it (木 before 休), and every kanji has a word the learner can fully read at the moment it is introduced.

Why: themes give the kanji something to hang on to and make words possible early. Frequency order would scatter them, stroke count order gives sets without any meaning. The sets replace the kana rows everywhere rows are used today.

### KD8: one step at a time

A new kanji is introduced alone. Its first word follows in the same session, once the kanji has been answered. Further words of that kanji wait until it has reached box 2, which means it has survived a review on a later day.

Why: meaning, shape, a reading and a new word at once is four new things. Spread over two or three days each step builds on something that already holds.

### KD9: pace of three new kanji per session

The default is three new kanji per smart session, each bringing its first word. The picker offers 0, 3 and 5 as for kana. A new kanji with its first word takes six cards, so reviews and the session length decide how many really fit (KR14). New material stops while twelve kanji and words are still in the first two boxes (KR31), which in practice allows two sessions with new material per day.

Why: with one session a day the kanji take about two months and the words follow a few weeks behind. Five a day feels fast in week one and collapses in week three, when the reviews pile up. The stop at twelve is what keeps a keen learner from doing that to themselves.

### KD10: kanji is a fourth script, never mixed with kana

The script switch gets a fourth choice, Kanji. Practice, Writing and Progress follow it as they do today. Kana and kanji never share a session. The streak and the answers per day count both.

Why: one place to switch, and every screen the learner already knows works the same way. The questions and the pace differ too much to mix in one session.

### KD11: stroke order from day one, writing from memory later

Every new kanji is shown being written and traced once on its intro card, and the Writing tab has Watch and Trace for all kanji. Writing from memory comes in a later release and stays out of smart practice.

Why: one trace forces a look at every stroke, which is what makes lookalikes (人 and 入, 日 and 目) tell apart later. Writing a 14 stroke kanji from memory in a five minute phone session is heavy and the exam does not ask for it, so it is an offer, not a gate. It also depends on the stroke check working for dense kanji, which has to be measured first.

### KD12: no lock on kana progress

Kanji can be started at any time. While fewer than the 46 basic hiragana have been seen, the kanji start card says that readings are in hiragana and recommends finishing those first.

Why: a lock punishes people who know kana from elsewhere or moved to a new device. A hint is enough.

### KD13: sound through the system voice

Words get a button that reads them with the Japanese system voice. It is hidden when the device has none. Nothing plays by itself.

Why: recorded clips exist for kana only. The system voice is free, works offline on iOS and is good enough for single words. No autoplay because people practice on the train, and because iOS and Chrome only speak after a tap anyway.

Known trap: since iOS 16 the Japanese voice can be missing from the list of voices and still speak. "Has none" therefore can't be read off that list alone, which is what `audio.ts` does today. The plan measures this on a real iPhone before the button is built.

### KD14: special readings are marked and come after the regular ones

Words whose reading can't be split over their kanji (今日 きょう, 一人 ひとり) are marked as special and taught as a whole. Among the words that are ready, the regular ones are introduced first.

Why: a beginner who meets 今日 before 今 and 日 concludes that readings are random. Met with the label, after a regular word, it is an exception to a rule that is already known. They must not wait long though: ひとり is among the first words anyone needs.

### KD15: no content from a model's memory

Meanings, readings and stroke data come from KANJIDIC2, JMdict and KanjiVG through a script. Whatever is written by hand or by a model (which words, the keyword, memory hooks, lookalike hints, the order) is checked against the source data by tests where a check is possible, and read by a second reviewer where it is not.

Why: a wrong reading learned from this app is worse than no app. This is the largest risk of the whole feature.

### KD16: no timed mode at first

The Timed switch is not offered for kanji until G1 to G3 are in use and there is real answer data to set limits from.

Why: speed is the last step of learning. The limits for kana come from the learner's own pace, for kanji there is none to start from.

### KD17: numbers with counters and dates come as groups

Hours, minutes, months, days of the month, hundreds, thousands, counting people and things, and the days of the week are taught as word groups: one card shows the whole pattern as a table, the irregular members are marked, and those are what gets practiced.

Why: this is the core of reading at N5 (prices, times, dates) and it does not fit the "few words per kanji" model: 分 alone has six irregular readings, the days of the month are eleven words. Most members are regular (二百 is に plus ひゃく) and need no drill, a learner has to know the pattern and the exceptions (三百 さんびゃく, 四時 よじ, 一日 ついたち). Shown as a table the exceptions stand out, taught one word at a time they look like chaos.

### KD18: the meaning of a word is asked, not only shown

A new word is tested for its reading and for its meaning.

Why: the learner knows no vocabulary. A word whose meaning is only shown turns into a sound without content (毎日 is まいにち, and what was it again?), and then the reading does not stick either.

## 4. What is learned

### Kanji

| Field | Source | Notes |
|---|---|---|
| character | KANJIDIC2, level tag | |
| keyword | picked by hand out of the source meanings | one, at most two words: 日 "day, sun" |
| other meanings | KANJIDIC2 | shown on the kanji sheet, asked nowhere |
| set and position | by hand | section 5 |
| parts | by hand, checked against KanjiVG | only parts that are kanji of the set and help to remember it: 休 = 人 + 木 |
| lookalikes | by hand | groups with a one line hint, as for kana |
| memory hook | by hand | one line, built on the picture or the parts. Must not pose as etymology |
| strokes | KanjiVG | same format as kana |
| readings | derived from its words | each with the word it comes from, labeled on or kun |

### Word

A word is a written form together with a reading. 一日 read いちにち and 一日 read ついたち are two words.

| Field | Source | Notes |
|---|---|---|
| written form | picked by hand, must exist in JMdict | only kanji of the set plus kana |
| reading | JMdict | in hiragana. Where JMdict gives one word two readings that are both in use at N5 (何: なに, なん), both are accepted as answers and the first is shown |
| meaning | JMdict gloss, shortened by hand | one short gloss |
| home kanji | derived | the kanji of the word that comes last in the order. The word belongs to it |
| reading per kanji | derived by a script | which part of the reading belongs to which kanji |
| special | derived | true when the reading can't be split over the kanji |
| meaning of a kanji in this word | by hand, optional, out of the source meanings | for words the keywords don't explain: 日本 is 日 "sun" + 本 "origin", not "book" |
| first word | by hand | one per kanji, the one the learner meets first. Preferably the kanji standing alone as a word (山 やま) |

Rules for picking words:

- KR1: every word is N5 vocabulary (taken from an open N5 word list) and is written with kanji of the set and kana only. Two exceptions, both still checked against JMdict: where a kanji has no N5 word the learner can read when it is introduced, its first word may be the kanji standing alone as a word JMdict marks as common (火 ひ, 土 つち). And the members of a word group (KR73) only have to be JMdict entries.
- KR2: every kanji owns at least one word, its first word, and at most four, groups not counted. A reading of a kanji that occurs in two or more N5 words of the set is shown by at least one picked word, owned by this kanji or by another.
- KR3: the first word of a kanji contains no kanji introduced later.
- KR4: a word with a special reading is never a first word.
- KR5: about 200 single words plus about 60 group members that are practiced. More is not better, see "Not in scope".

### Word groups

- KR73: the groups are: days of the week (日曜日 to 土曜日, 何曜日), counting things (一つ to 十), people (一人, 二人, 三人 ...), hundreds, thousands, hours, minutes, months, days of the month (一日 to 十日, 二十日). A group has a counter kanji, which is its home kanji.
- KR74: a group table lists only members that are JMdict entries, with the JMdict reading. A member is marked irregular when its reading is not simply the reading of the number followed by the reading of the counter. That mark is computed, not set by hand.
- KR75: practiced as words are: every irregular member, one regular member per group so the pattern itself is practiced, and the question word (何時, 何人) where there is one. Days of the week, counting things and days of the month are practiced in full, they are N5 words each.
- KR76: a group is ready when its home kanji is in box 2 or higher and all kanji in it have been seen. It starts with a group card: the table, irregular members marked, not scored. After that its practiced members come in as further words (KR29, KR30), in table order.
- KR77: the group card can be opened again at any time from the sheet of its home kanji and from the feedback of any of its members.

## 5. Order

- KR6: sets of four to eight kanji, each with an English title a beginner understands ("Numbers 1 to 5", "People").
- KR7: 曜 comes in one set with 週, and the group of the weekdays becomes ready with it.
- KR8: a kanji never comes before a part of it that is in the set. Which parts a kanji has is written down by hand and only where the part can be seen and helps to remember it (休 = 人 + 木, not every kanji with a 口 somewhere).
- KR9: lookalikes that fall into one set are introduced one after the other, so the difference is fresh (as kana lookalikes are today). Where the theme puts them into different sets, the intro card of the later one shows the earlier one next to it (KR11).
- KR10: KR3, KR7 and KR8 are checked by a test over the data, not by eye.

The draft of the sets is in section 12. The data phase turns it into the final order and may move single kanji to satisfy KR3 and KR8.

## 6. How it is learned

### First contact

- KR11: a new kanji gets an intro card: the kanji large, keyword, memory hook, parts if it has any, the stroke order animation, then one trace. A lookalike already seen or part of this session is shown next to it with the hint. The card is not scored.
- KR12: the intro is followed by two tests of the kanji in the same session, with other cards in between (as for kana).
- KR13: a new word gets an intro card: the word large, reading in hiragana, meaning, the sound button, and one line per kanji with its keyword or its meaning in this word. Not scored. Two tests follow, one for the reading and one for the meaning. When the word is the kanji standing alone, the card is short and says so ("As a word: 山 やま, mountain"), the kanji was just introduced.
- KR14: a new kanji and its first word are planned together and take six cards (two intros, four tests). A kanji is only started when all six fit into the room the reviews leave. The word cards come after the kanji has been answered right once. If that does not happen in the session, the word cards are dropped and the word is first in line next time.

### Question types

| Id | Shown | Answer | Input | Trains |
|---|---|---|---|---|
| M1 | kanji | keyword | choice of 4 | G1 |
| M2 | keyword | kanji | choice of 4 | G1, G3 |
| V1 | word in kanji | meaning | choice of 4 | G2 |
| R1 | word in kanji | reading | choice of 4 readings | G2 |
| R2 | word in kanji | reading | typed | G2 |
| S1 | reading and meaning | written form | choice of 4 | G3 |
| W1 | keyword and the reading of the first word | the kanji, drawn | canvas | G4, later release |

- KR71: every card says in words what is asked ("What does it mean?", "How is it read?", "Which kanji?"). The same 一 is shown for its meaning and, a minute later, as a word for its reading, and nothing else on the card tells the two apart.
- KR15: the wrong options of M1 are keywords of other kanji, picked in the order of KR16. An option is never offered when it shares an entry with the source meanings of the answer, or when the pair is on a hand kept list of meanings too close to tell apart ("tall" and "up"). A test holds both.
- KR16: M2 and S1 take their wrong options from, in this order: what this learner confused before, the lookalike group, kanji with the same reading (S1), the same set, any kanji met so far. While the learner has met fewer kanji than a card needs, the options are filled from the set being learned.
- KR72: the wrong options of V1 are meanings of other words, words the learner has met first. The rule of KR15 against meanings too close to the answer applies.
- KR17: R1 builds its wrong readings the way the exam does: the right reading with a vowel shortened or lengthened, a small っ added or dropped, a consonant voiced or unvoiced, or another reading of the same kanji put in (がっこう, がこう, がっこ, かっこう). Where that gives too few (に, め, て), readings of other words the learner knows fill up. A wrong option is never a reading the source accepts for that word.
- KR18: S1 builds its wrong forms by swapping one kanji of the word for a lookalike or for a kanji with the same reading (ひと: 人, 入, 八, 大).
- KR19: every question has "Don't know", as today. It counts as wrong and stores no confusion.
- KR78: where two picked words share a written form (一日), a card that shows the form also shows which one is meant, by its meaning.

### Typing a reading (R2)

- KR20: the answer is the reading in hiragana. The learner types romaji on the normal keyboard and sees the hiragana it turns into before sending it off. Typing kana directly with a Japanese keyboard works too.
- KR21: the romaji follows the kana spelling: `gakkou` gives がっこう, `nn` or `n` before a consonant or at the end gives ん, the spellings accepted for kana today (si, tu, hu, ...) stay accepted. No macrons.
- KR22: an answer that differs from the right one only in one of these ways is a real mistake with a name, not a typo: vowel length, a small っ, voicing, a long vowel spelled with the wrong kana (おう for おお, ええ for えい). It counts as wrong and the kind is stored (KR33). The comparison is made in kana.
- KR23: of what is left, an answer one keystroke off in romaji gets one more try without counting, the same way typos are treated for kana. The second slip counts as wrong and leaves the box alone.

### Which question when

Smart practice and the Mixed mode pick the type from how well the item is known, easiest first:

- KR24: kanji in box 0 and 1: M1. Box 2: M2. From box 3: of M1 and M2 the one with fewer right answers so far.
- KR25: word in box 0 and 1: R1 and V1, the one with fewer right answers so far. Box 2: R2. From box 3: of R2, S1 and V1 the one with the fewest right answers so far.
- KR26: W1 is never picked by smart practice. It has its own mode and the Writing tab (KD11).

### Schedule

- KR27: kanji and words use the Leitner boxes and intervals the kana use, with the same rules: only a due item moves up, a miss goes back to box 0, a right answer on the re-ask in the same session can't move up, typos leave the box alone.
- KR28: a smart session is filled in this order: due kanji and words, weak ones, new material, then whatever is due next. New material is new kanji (each with its first word), further words whose kanji are ready, and groups that are ready.
- KR29: a further word is ready when all its kanji have been seen and its home kanji is in box 2 or higher. Among the ready words of a kanji the special ones come last.
- KR30: per session at most as many new kanji as the picker says, and at most the same number of further words. Further words come before new kanji when both are ready and room is short. A group card does not count against either limit, the members that follow it do.
- KR31: no new kanji, words or groups while twelve or more kanji and words are in box 0 or 1. The hero says why, as it does for kana today.
- KR32: a missed item comes back three to six cards later in the type that was missed, at most twice per session, as today.

### Feedback

- KR33: a wrong reading names its kind when it has one: long vowel, small っ, voicing, wrong kana for a long vowel, or "that is how 国 is read in 外国, here it is くに". The right reading is shown in large hiragana.
- KR34: after any reading question the meaning of the word is shown, right or wrong, and stays long enough to be read (the jump to the next card after a right answer takes at least a second).
- KR35: a wrong M1, M2 or S1 shows what was picked next to what was right, each with its keyword, and the lookalike hint when the two are in one group.
- KR36: the sound button is on every word intro and on the feedback of every question about a word.

### Patterns

The pattern cards on the results screen and the Progress tab get kanji versions. Each has a practice button, as today.

- KR37: confused pairs of kanji, with the lookalike hint when there is one.
- KR38: reading habits across words: long vowels, small っ, voicing. These are habits, not single words, so they are counted over all words.
- KR39: gap between meaning and reading: kanji known by meaning whose words are weak.
- KR40: weak set, in place of the weak row.
- KR41: slipping (missed again after being mastered), as today.

## 7. Screens

Everything not listed stays as it is for kana.

### Script switch

- KR42: four choices: Hiragana, Katakana, Both, Kanji. The pick is remembered.
- KR43: with Kanji picked, the kana choices show a dot when kana are due. With a kana script picked, Kanji shows a dot when kanji or words are due. Nobody loses reviews in the part that is not on screen. Between Hiragana and Katakana nothing changes.

### Practice tab with Kanji picked

- KR44: the hero shows the plan of the next smart session (due, new kanji, new words), the next new kanji, and a ring for kanji seen out of the whole set. Before the first session it says what kanji practice is in two lines, plus the hint from KD12 when it applies.
- KR45: tiles for mastered, learning and open errors count kanji and words together and say so.
- KR46: modes: Meaning (M1), Recognize (M2), Words (V1), Reading (R1 and R2 by box), Spelling (S1), Mixed. Write (W1) is added with the writing release. No Timed switch (KD16).
- KR47: the set picker takes the place of the row picker: one entry per set with title, its kanji, and a bar for mastered and learning. A custom quiz runs over the picked sets and, in the word modes, over the words of their kanji that have been introduced.
- KR48: with sets picked, new kanji in smart practice come from those sets only, and the hero has the same "Use all" way out it has for rows.

### Writing tab with Kanji picked

- KR49: chips for the sets, then the kanji of the set. The panel shows kanji, keyword, memory hook, parts, lookalikes and its words with readings.
- KR50: Watch and Trace from the first release. Write from memory with the writing release, with the same rules as for kana (a clean write counts once per kanji and day, a kanji not yet in practice is not stored).

### Progress tab with Kanji picked

- KR51: summary: kanji seen and mastered out of the whole set, words mastered, accuracy.
- KR52: the chart shows the kanji by set, colored by stage, with the dots for due and open errors. Sets nobody has started stay folded.
- KR53: patterns, open errors and the table list kanji and words. The table can be narrowed to one of the two.

### Kanji sheet

- KR54: opens from the chart, the table, the results and from any kanji inside a word. Top to bottom: stroke demo, keyword and other meanings, stage, next review and accuracy, memory hook, parts, its words (each with reading, meaning, sound button, stage, and whether it is unlocked yet), its group if it is the home of one, readings labeled on and kun, confusions, lookalikes, practice button.
- KR55: on and kun are explained in one line the first time the sheet is opened, not on any quiz card.

### Quiz and results

- KR56: a kanji in a question is at least as large as kana are today. In the choices of M2 and S1 the kanji are large enough to tell 日 from 目 on a phone without zooming. Words of three kanji, readings of five kana and two word keywords fit their cards at 375px.
- KR57: all Japanese text is rendered with a Japanese font and marked as Japanese, so no device shows the Chinese shape of a kanji.
- KR58: the results screen scores kanji and words as it scores kana (per item, first try or not), lists what was missed with reading and meaning, and shows what moved up, fell back and was mastered.
- KR59: the result line says "kanji and words", the missed list opens the kanji sheet.

## 8. Content quality

- KR60: one script builds the kanji data from pinned versions of the sources. Running it again gives the same file. The generated file is not edited by hand.
- KR61: tests fail when a keyword is not among the source meanings of its kanji, a word or its reading is not in JMdict, a word contains a kanji outside the set, a word is not in the N5 word list and not one of the exceptions of KR1, or a rule of section 4 or 5 is broken.
- KR62: memory hooks and lookalike hints are read by a second reviewer who did not write them, with the stroke data and the source meanings at hand. A hook that states a wrong fact about the kanji is rejected, a hook that is merely plain is fine.
- KR63: the app has a Sources section of its own, reachable from the settings, that credits KANJIDIC2 and JMdict (EDRDG, CC BY-SA 4.0), KanjiVG (CC BY-SA 3.0) and the N5 word list, each with a link, its licence and the version of the data in the app. The EDRDG licence asks for a separate screen, a line on a start screen is not enough. The README carries the same credits.
- KR70: the EDRDG licence wants the data kept current. The data is rebuilt from the newest source release whenever a release of the app touches kanji content, and at least twice a year. The Sources section shows the date, so a stale copy is visible.

## 9. Everything else

- KR64: all of it works offline once the app has been opened online, as today. The sound button is the exception on devices whose voice needs the network.
- KR65: the kanji data and code are loaded when Kanji is picked for the first time, not at app start. Someone who only uses kana does not wait for it. The service worker may fetch it in the background so it is there offline.
- KR66: kana progress and preferences are untouched. A backup made after this feature carries kanji progress. A backup from before still imports and leaves kanji progress alone. The confirm step says how many kana and how many kanji a backup holds.
- KR67: Reset wipes kanji progress too and says so.
- KR68: Playground, Sumi and Yoru, each in light and dark, look right on every new screen part. Touch targets stay at 44px.
- KR69: kanji are shown in the font of the font picker. The plan checks that every font in the picker has all kanji of the set. A font that does not is fixed then, nothing is built for the case before it is found.

## 10. Releases

Each one is useful by itself and is built on the one before. A requirement that covers kanji and words is met for kanji in K1 and for words in K2. The data rules (KR1 to KR10, KR60 to KR62, KR73 to KR75) are met once, by the data phase of the plan, before K1.

| | The learner gets | Requirements |
|---|---|---|
| K1 Meet the kanji | the sets, intro cards with stroke order and trace, M1 and M2, smart practice and custom quiz for kanji, results, Writing tab with Watch and Trace, Progress tab, kanji sheet, sources, backup and reset | KR11, KR12, KR15, KR16, KR19, KR24, KR27, KR28, KR30 to KR32, KR35, KR42 to KR59, KR63 to KR71 |
| K2 Read the words | words and their intros, V1, R1, R2 with kana typing, S1, the unlock rules, reading feedback, sound, words on every screen | KR13, KR14, KR17, KR18, KR20 to KR23, KR25, KR29, KR33, KR34, KR36, KR72, KR78, and the word side of KR16, KR28, KR30, KR31, KR35, KR44 to KR47, KR49, KR51, KR53, KR54, KR58 |
| K3 Numbers and dates | the word groups with their table cards | KR76, KR77, and groups in KR28, KR30, KR54 |
| K4 Know your mistakes | pattern cards for kanji and words | KR37 to KR41 |
| K5 Write from memory | W1 as a mode, Write on the Writing tab | KR26, and Write in KR46 and KR50 |

K5 only happens if the stroke check holds up for kanji with many strokes, which the plan measures before anything else is built.

## 11. Checked before building

Facts these requirements lean on, to be confirmed in the first phase of the plan. If one fails, the decision behind it is taken again.

- The exact list: the kanji with level 4 in KANJIDIC2, and whether 新 is among them (KD1).
- The stroke check accepts honest strokes and still catches order and direction faults on the densest kanji of the set, which have 14 strokes (語, 読, 聞, 駅) and 18 for 曜 (KD11, K5).
- Every font in the picker has all kanji of the set. All seven are full Japanese families, so this should hold, but nobody has looked at the glyphs yet (KR69).
- A Japanese system voice speaks on iOS (browser and installed app) and on Android without setup, and the app can tell when there is none (KD13).
- The kanji chunk is of a size a phone on a slow line can take (KR65).
- What the EDRDG licence asks of an app that ships a small pinned extract (KR63, KR70).
- The number words of the groups are JMdict entries (KR74). A group whose members are mostly missing there is dropped or shown as a table only.

## 12. Draft of the sets

103 kanji in 17 sets, by KD7: the 102 counted so far plus 曜. The first word of each kanji and the final position inside a set come out of the data phase, which may move single kanji (KR3, KR8).

| # | Set | Kanji | Why here |
|---|---|---|---|
| 1 | Numbers 1 to 5 | 一 二 三 四 五 | Three of them explain themselves. Words from the first minute |
| 2 | Numbers 6 to 10 | 六 七 八 九 十 | |
| 3 | Big numbers and money | 百 千 万 円 | Prices, the first thing a visitor has to read. The groups for hundreds and thousands hang on this set |
| 4 | Sun, moon and elements | 日 月 火 水 木 金 土 | Pictures. The days of the week later hang on these seven |
| 5 | People | 人 男 女 子 父 母 友 | |
| 6 | Body | 口 目 耳 手 足 | Pictures again, and parts of many later kanji |
| 7 | Big and small | 大 小 高 長 白 多 少 | First adjectives. 大 builds on 人, 少 on 小 |
| 8 | Nature | 山 川 天 気 雨 空 花 魚 | 天 builds on 大 |
| 9 | Where | 上 下 中 外 左 右 前 後 | Pairs, learned as pairs |
| 10 | Compass and country | 東 西 南 北 国 | |
| 11 | Clock | 時 分 半 間 今 午 | 午前 and 午後 need 前 and 後 from set 9. Hours and minutes become ready here |
| 12 | School | 学 校 生 先 本 名 何 | 学生, 先生, 学校: the first words made of two learned kanji |
| 13 | Language | 言 語 話 読 書 聞 見 | 言 first, three others contain it. 聞 on 耳, 見 on 目 |
| 14 | Coming and going | 行 来 出 入 立 会 休 | First verbs. 入 next to 人 and 八 |
| 15 | Calendar | 年 毎 週 曜 | The weekdays become ready here (KR7) |
| 16 | Eating and shopping | 食 飲 買 店 安 古 | 新 would go here next to 古 if it is in the list |
| 17 | Town | 駅 道 社 車 電 | 電 builds on 雨. 電車, 電話, 会社 |

Known knots for the data phase:

- 百 comes long before 白, so 百 does not list 白 as a part. When 白 is introduced, 百 is shown next to it as a lookalike.
- 天 and 気 have one N5 word between them, 天気. Whichever comes first needs a stand alone first word under the exception of KR1.
- 火 and 土 get stand alone first words under the same exception and their N5 words (the weekdays) only in set 15.
- 友 may have no N5 word without a kanji outside the set (友達). Then it takes the exception too.
- Months and days of the month have 月 and 日 as home kanji, both in set 4. Those groups are ready early, which is wanted: dates are among the first things worth reading.

Lookalike groups to start from, kanji of the set only: 人 入 八, 大 天, 木 本, 日 目 白 百, 土 上, 千 午, 右 左, 小 少, 今 会 食, 間 聞, 東 車, 母 毎, 四 西, 先 生 年, and 語 話 読, which differ only in their right half. The content phase checks each group against the glyphs and adds what real confusions show.
