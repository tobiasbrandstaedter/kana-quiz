// Builds src/data/kanjiSource.ts and src/data/kanjiStrokes.ts for the course in
// src/data/kanjiCourse.ts. Run by hand, the output is committed:
//   node scripts/extract-kanji.mjs
//   node scripts/extract-kanji.mjs --candidates   also writes scripts/.cache/candidates.md
// Downloads are kept in scripts/.cache/sources/ (git ignored), missing ones are fetched.
// Behind a proxy run it with NODE_USE_ENV_PROXY=1.
// The sources are CC BY-SA (EDRDG 4.0, KanjiVG 3.0), so are the generated files.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { KANJI_SETS, WORD_GROUPS } from '../src/data/kanjiCourse.ts'

// pinned so a rerun gives the same files, bump these to refresh the data (KR70)
const JMDICT_TAG = '3.6.2+20261116213322'          // jmdict-simplified, KANJIDIC2 and JMdict
const FURIGANA_TAG = '2.3.1+2026-10-25'            // JmdictFurigana
const KANJIVG_TAG = 'r20260714'                    // same as extract-strokes.mjs
const N5_COMMIT = '9b20cfa8d59e56018702543aa9060cb72a263692'  // open-anki-jlpt-decks, src/n5.csv

const JMDICT_VERSION = JMDICT_TAG.split('+')[0]
const FURIGANA_VERSION = FURIGANA_TAG.split('+')[0]
const SIMPLIFIED = `https://github.com/scriptin/jmdict-simplified/releases/download/${encodeURIComponent(JMDICT_TAG)}`
const CACHE = new URL('./.cache/', import.meta.url)
const SOURCES = new URL('sources/', CACHE)
const withCandidates = process.argv.includes('--candidates')

function fail(msg) {
  console.error(`extract-kanji: ${msg}`)
  process.exit(1)
}

async function download(url, file) {
  console.log(`fetching ${url}`)
  const res = await fetch(url)
  if (!res.ok) fail(`could not fetch ${url} (HTTP ${res.status}). Behind a proxy set NODE_USE_ENV_PROXY=1`)
  mkdirSync(new URL('.', file), { recursive: true })
  writeFileSync(file, Buffer.from(await res.arrayBuffer()))
}

// one file out of a .tar.gz, enough tar for the archives of these releases
function untar(gz, wanted) {
  const buf = gunzipSync(gz)
  for (let at = 0; at + 512 <= buf.length;) {
    const name = buf.toString('utf8', at, at + 100).replace(/\0[\s\S]*$/, '')
    if (!name) break
    const size = parseInt(buf.toString('ascii', at + 124, at + 136).replace(/\0[\s\S]*$/, '').trim(), 8) || 0
    if (name.split('/').pop() === wanted) return buf.subarray(at + 512, at + 512 + size)
    at += 512 + Math.ceil(size / 512) * 512
  }
  fail(`${wanted} is not in the downloaded archive, check the pinned version`)
}

// cached json out of a release archive, downloaded and unpacked when missing
async function archivedJson(dir, archive, url, inner, local) {
  const file = new URL(dir + local, SOURCES)
  if (!existsSync(file)) {
    const gz = new URL(dir + archive, SOURCES)
    if (!existsSync(gz)) await download(url, gz)
    writeFileSync(file, untar(readFileSync(gz), inner))
  }
  return JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''))
}

async function cachedText(path, url) {
  const file = new URL(path, SOURCES)
  if (!existsSync(file)) await download(url, file)
  return readFileSync(file, 'utf8')
}

// --- text helpers ---

const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
const isHan = ch => /\p{Script=Han}/u.test(ch)
const isKana = ch => /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(ch)
const unique = xs => [...new Set(xs)]

// --- sources ---

const kanjidic = await archivedJson('', `kanjidic2-en-${JMDICT_TAG}.json.tgz`,
  `${SIMPLIFIED}/kanjidic2-en-${encodeURIComponent(JMDICT_TAG)}.json.tgz`,
  `kanjidic2-en-${JMDICT_VERSION}.json`, `kanjidic2-en-${JMDICT_VERSION}.json`)
const jmdict = await archivedJson('', `jmdict-eng-${JMDICT_TAG}.json.tgz`,
  `${SIMPLIFIED}/jmdict-eng-${encodeURIComponent(JMDICT_TAG)}.json.tgz`,
  `jmdict-eng-${JMDICT_VERSION}.json`, `jmdict-eng-${JMDICT_VERSION}.json`)
const furigana = await archivedJson(`jmdictfurigana-${FURIGANA_VERSION}/`, 'JmdictFurigana.json.tar.gz',
  `https://github.com/Doublevil/JmdictFurigana/releases/download/${encodeURIComponent(FURIGANA_TAG)}/JmdictFurigana.json.tar.gz`,
  'JmdictFurigana.json', 'JmdictFurigana.json')
const n5csv = await cachedText(`n5-${N5_COMMIT.slice(0, 8)}.csv`,
  `https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/${N5_COMMIT}/src/n5.csv`)

// The set: former JLPT level 4 in KANJIDIC2 plus 曜 (KD1), in the order of the file
const characters = new Map(kanjidic.characters.map(c => [c.literal, c]))
const SET = [...kanjidic.characters.filter(c => c.misc.jlptLevel === 4).map(c => c.literal), '曜']
const IN_SET = new Set(SET)
const setOnly = form => [...form].some(isHan) && [...form].every(ch => IN_SET.has(ch) || isKana(ch))

async function kanjivg(k) {
  const file = k.codePointAt(0).toString(16).padStart(5, '0') + '.svg'
  return cachedText(`kanjivg-${KANJIVG_TAG}/${file}`, `https://raw.githubusercontent.com/KanjiVG/kanjivg/${KANJIVG_TAG}/kanji/${file}`)
}

const strokes = {}
const kanjiSource = {}
for (const k of SET) {
  const svg = await kanjivg(k)
  const paths = [...svg.matchAll(/<path id="kvg:[^"]*-s(\d+)"[^>]*\sd="([^"]+)"/g)]
    .sort((a, b) => a[1] - b[1])
    .map(m => m[2])
  const numbers = [...svg.matchAll(/<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">(\d+)<\/text>/g)]
    .sort((a, b) => a[3] - b[3])
    .map(m => [Number(m[1]), Number(m[2])])
  if (paths.length === 0 || paths.length !== numbers.length)
    fail(`KanjiVG file of ${k}: ${paths.length} strokes but ${numbers.length} stroke numbers`)
  strokes[k] = { paths, numbers }

  // parts: every element of a sub group, 亻 counts as 人 through kvg:original
  const parts = [...svg.matchAll(/<g id="kvg:[0-9a-f]+-g\d+"([^>]*)>/g)]
    .flatMap(m => [...m[1].matchAll(/kvg:(?:element|original)="([^"]+)"/g)].map(a => a[1]))
    .filter(p => p !== k && IN_SET.has(p))

  const c = characters.get(k)
  const groups = c.readingMeaning?.groups ?? []
  const readings = groups.flatMap(g => g.readings)
  kanjiSource[k] = {
    meanings: unique(groups.flatMap(g => g.meanings.filter(m => m.lang === 'en').map(m => m.value))),
    on: unique(readings.filter(r => r.type === 'ja_on').map(r => toHira(r.value))),
    kun: unique(readings.filter(r => r.type === 'ja_kun').map(r => r.value.replace(/-/g, ''))),
    strokes: c.misc.strokeCounts[0],
    parts: unique(parts),
    n5Readings: [],
  }
}

// JMdict: by id, and by written form for forms made of set kanji and kana
const byId = new Map()
const byForm = new Map()
for (const w of jmdict.words) {
  byId.set(w.id, w)
  for (const k of w.kanji) {
    if (!setOnly(k.text)) continue
    if (!byForm.has(k.text)) byForm.set(k.text, [])
    byForm.get(k.text).push(w)
  }
}

// kana a learner should never be offered: search only, outdated, irregular, rare
const HIDDEN_KANA = new Set(['sk', 'ok', 'ik', 'rk'])
const kanaFor = (w, form) => w.kana.filter(r =>
  (r.appliesToKanji.includes('*') || r.appliesToKanji.includes(form)) && !r.tags.some(t => HIDDEN_KANA.has(t)))
const readingsFor = (w, form) => unique(kanaFor(w, form).map(r => toHira(r.text)))
const isCommon = w => w.kanji.some(k => k.common) || w.kana.some(r => r.common)

function glossesFor(w, form, reading) {
  const kana = kanaFor(w, form).filter(r => toHira(r.text) === reading).map(r => r.text)
  return w.sense
    .filter(s => (s.appliesToKanji.includes('*') || s.appliesToKanji.includes(form)) &&
      (s.appliesToKana.includes('*') || s.appliesToKana.some(r => kana.includes(r))))
    .slice(0, 3)
    .map(s => s.gloss.map(g => g.text).join('; '))
}

// readings the entries of a form mark as common, for the regular test of group members
const commonReadings = form => unique((byForm.get(form) ?? [])
  .flatMap(w => kanaFor(w, form).filter(r => r.common).map(r => toHira(r.text))))

// --- N5 word list ---

function parseCsv(s) {
  const rows = []
  let row = [], field = '', quoted = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += c
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.length > 1)
}

const [, ...n5Rows] = parseCsv(n5csv)
// form -> its readings in the list, in file order. Counter rows (～時) are left out,
// "十,(〜を) とお" loses its bracket, "なん; なに" and "足; 脚" are split.
const n5ByForm = new Map()
for (const [expression, reading] of n5Rows) {
  if (/[～〜]/.test(expression)) continue
  const readings = reading.replace(/\([^)]*\)/g, '').split(/;\s*/).map(r => toHira(r.trim())).filter(Boolean)
  for (const form of expression.split(/;\s*/).map(f => f.trim())) {
    if (!n5ByForm.has(form)) n5ByForm.set(form, [])
    n5ByForm.get(form).push(...readings)
  }
}
const inN5 = (form, reading) => (n5ByForm.get(form) ?? []).includes(reading)

// --- splitting a reading over the kanji ---

const furiganaByKey = new Map(furigana.map(e => [e.text + '|' + toHira(e.reading), e.furigana]))

const VOICED = {
  か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ',
  た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど', は: 'ばぱ', ひ: 'びぴ', ふ: 'ぶぷ', へ: 'べぺ', ほ: 'ぼぽ',
}
// a reading as it can come out at a joint: voiced or with handakuten at the start,
// a small っ in place of its last kana (がく -> がっ, いち -> いっ)
function jointForms(r) {
  const out = []
  for (const first of [r[0], ...(VOICED[r[0]] ?? '')]) {
    const v = first + r.slice(1)
    out.push(v)
    if (v.length > 1) out.push(v.slice(0, -1) + 'っ')
  }
  return out
}

function kindOf(k, reading) {
  const on = kanjiSource[k].on
  const kun = kanjiSource[k].kun.map(r => r.split('.')[0])
  if (on.includes(reading)) return 'on'
  if (kun.includes(reading)) return 'kun'
  if (on.some(r => jointForms(r).includes(reading))) return 'on'
  if (kun.some(r => jointForms(r).includes(reading))) return 'kun'
  return undefined
}

function splitOf(form, reading) {
  const parts = furiganaByKey.get(form + '|' + reading)
  if (!parts) return []
  return parts.map(p => {
    const part = { text: p.ruby, reading: toHira(p.rt ?? p.ruby) }
    const kind = IN_SET.has(p.ruby) ? kindOf(p.ruby, part.reading) : undefined
    return kind ? { ...part, kind } : part
  })
}
const isSpecial = split => split.some(p => [...p.text].filter(isHan).length > 1)

// --- picked words ---

function shownReading(w, form, wanted, where) {
  const readings = readingsFor(w, form)
  if (readings.length === 0) fail(`${where}: JMdict entry ${w.id} gives no reading for ${form}`)
  if (wanted) {
    if (!readings.includes(wanted))
      fail(`${where}: JMdict entry ${w.id} has no reading ${wanted} for ${form}, it has ${readings.join(', ')}`)
    return wanted
  }
  return (n5ByForm.get(form) ?? []).find(r => readings.includes(r)) ?? readings[0]
}

function sourceWord(w, form, reading) {
  const split = splitOf(form, reading)
  return {
    form,
    jmdict: w.id,
    reading,
    readings: readingsFor(w, form),
    glosses: glossesFor(w, form, reading),
    n5: inN5(form, reading),
    common: isCommon(w),
    split,
    special: isSpecial(split),
  }
}

function checkChars(form, where) {
  const outside = [...form].filter(ch => !IN_SET.has(ch) && !isKana(ch))
  if (outside.length) fail(`${where}: ${form} has ${outside.join(' ')}, which is not a kanji of the set or kana. Pick another word`)
}

const words = {}
// form:jmdict -> word id, for course entries without a reading of their own
const defaultIds = {}
const noSplit = []

function addWord(w, ref, where) {
  const reading = shownReading(w, ref.form, ref.reading, where)
  const id = `w:${ref.form}:${reading}`
  words[id] = sourceWord(w, ref.form, reading)
  if (!ref.reading) defaultIds[`${ref.form}:${ref.jmdict}`] = id
  if (words[id].split.length === 0) noSplit.push(`${ref.form} ${reading}`)
  return id
}

for (const set of KANJI_SETS) {
  for (const k of set.kanji) {
    for (const cw of k.words) {
      const where = `kanjiCourse.ts, word ${cw.form} under ${k.kanji}`
      checkChars(cw.form, where)
      const w = byId.get(cw.jmdict)
      if (!w) fail(`${where}: JMdict has no entry ${cw.jmdict}. Copy the id from scripts/.cache/candidates.md`)
      if (!w.kanji.some(f => f.text === cw.form))
        fail(`${where}: JMdict entry ${cw.jmdict} is written ${w.kanji.map(f => f.text).join(', ') || 'in kana only'}, not ${cw.form}. Fix the form or the id`)
      addWord(w, cw, where)
    }
  }
}

// --- word groups ---

// What a kanji reads as its own word in the course (四 し, or よん if the author pins
// that), taken from the course as it is now. The irregular mark builds on these.
const ownReading = new Map()
for (const set of KANJI_SETS)
  for (const k of set.kanji) {
    const own = k.words.find(w => w.form === k.kanji)
    if (own) ownReading.set(k.kanji, own.reading ?? words[defaultIds[`${own.form}:${own.jmdict}`]].reading)
  }

// regular: the number read the way its kanji read as words of their own (十一 is じゅう
// plus いち) followed by some common reading of the rest. The number is what comes before
// the counter kanji, or the leading kanji when the counter isn't in the form (一つ).
// null when a kanji of the number has no word of its own in the course yet.
function numberPart(form, counter) {
  const at = counter ? form.indexOf(counter) : -1
  return at > 0 ? form.slice(0, at) : form.match(/^\p{Script=Han}+/u)?.[0] ?? ''
}

function isIrregular(form, reading, counter) {
  const head = numberPart(form, counter)
  if ([...head].some(ch => !ownReading.has(ch))) return null
  const h = [...head].map(ch => ownReading.get(ch)).join('')
  const tail = form.slice(head.length)
  const tails = tail === '' ? [''] : [...tail].every(isKana) ? [toHira(tail)] : commonReadings(tail)
  return !tails.some(t => h + t === reading)
}

const groups = {}
const missing = []
for (const g of WORD_GROUPS) {
  const resolve = (m) => {
    const where = `kanjiCourse.ts, group ${g.id}, ${m.form}`
    checkChars(m.form, where)
    const w = byId.get(m.jmdict)
    if (!w || !w.kanji.some(f => f.text === m.form)) {
      missing.push(`${g.id}: ${m.form} (${m.jmdict})`)
      return null
    }
    return addWord(w, m, where)
  }
  const members = g.members.map(m => ({ m, id: resolve(m) })).filter(x => x.id).map(({ m, id }) => {
    // a group practiced in full has no number in front of a counter (weekdays, 一つ), a mark would mislead
    if (g.practice === 'all') return { word: id, irregular: false }
    const irregular = isIrregular(m.form, words[id].reading, g.counter)
    if (irregular === null) {
      const lacking = [...numberPart(m.form, g.counter)].filter(ch => !ownReading.has(ch))
      fail(`kanjiCourse.ts, group ${g.id}, ${m.form}: ${lacking.join(' ')} has no word written as the kanji alone in the course yet. ` +
        'The irregular mark reads the number the way that word does, add it first')
    }
    return { word: id, irregular }
  })
  // the mark means nothing for a question word, so it has none
  groups[g.id] = { members, question: g.question ? resolve(g.question) : null }
}

// --- readings a kanji has in two or more N5 words of the set (KR2) ---

const n5Words = []
for (const [form, readings] of n5ByForm) {
  if (!setOnly(form)) continue
  for (const reading of unique(readings)) {
    const entries = (byForm.get(form) ?? []).filter(w => readingsFor(w, form).includes(reading))
    if (entries.length) n5Words.push({ form, reading, entries, split: splitOf(form, reading) })
  }
}
for (const k of SET) {
  const count = new Map()
  for (const nw of n5Words)
    for (const r of unique(nw.split.filter(p => p.text === k).map(p => p.reading)))
      count.set(r, (count.get(r) ?? 0) + 1)
  kanjiSource[k].n5Readings = [...count].filter(([, n]) => n >= 2).map(([r]) => r)
}

// --- write ---

const sourceInfo = [
  {
    name: 'KANJIDIC2', version: `${kanjidic.dictDate} (database ${kanjidic.databaseVersion}), JSON by jmdict-simplified ${JMDICT_TAG}`,
    url: 'https://www.edrdg.org/wiki/index.php/KANJIDIC_Project',
    licence: 'CC BY-SA 4.0, Electronic Dictionary Research and Development Group', licenceUrl: 'https://www.edrdg.org/edrdg/licence.html',
  },
  {
    name: 'JMdict', version: `${jmdict.dictDate}, JSON by jmdict-simplified ${JMDICT_TAG}`,
    url: 'https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project',
    licence: 'CC BY-SA 4.0, Electronic Dictionary Research and Development Group', licenceUrl: 'https://www.edrdg.org/edrdg/licence.html',
  },
  {
    name: 'JmdictFurigana', version: FURIGANA_TAG,
    url: 'https://github.com/Doublevil/JmdictFurigana',
    licence: 'CC BY-SA, as JMdict', licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  {
    name: 'KanjiVG', version: KANJIVG_TAG,
    url: 'https://kanjivg.tagaini.net',
    licence: 'CC BY-SA 3.0, Ulrich Apel', licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  {
    name: 'JLPT N5 word list (open-anki-jlpt-decks, from tanos.co.uk)', version: N5_COMMIT.slice(0, 8),
    url: 'https://github.com/jamsinclair/open-anki-jlpt-decks',
    licence: 'CC BY, repository MIT', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  },
]

const header = `// Generated by scripts/extract-kanji.mjs, do not edit by hand.
// KANJIDIC2 and JMdict (c) Electronic Dictionary Research and Development Group, CC BY-SA 4.0,
// https://www.edrdg.org/edrdg/licence.html, as JSON from jmdict-simplified ${JMDICT_TAG}.
// Reading splits from JmdictFurigana ${FURIGANA_TAG} (CC BY-SA, https://github.com/Doublevil/JmdictFurigana).
// KanjiVG ${KANJIVG_TAG} (c) Ulrich Apel, CC BY-SA 3.0, https://kanjivg.tagaini.net.
// N5 word list from https://github.com/jamsinclair/open-anki-jlpt-decks at ${N5_COMMIT.slice(0, 8)}.
`
const lines = obj => Object.entries(obj).map(([key, v]) => `  '${key}': ${JSON.stringify(v)},`).join('\n')

writeFileSync(new URL('../src/data/kanjiSource.ts', import.meta.url), `${header}// This file is under CC BY-SA 4.0.
import type { KanjiSourceInfo, SourceGroup, SourceKanji, SourceWord } from '../types'

export const KANJI_DATA_DATE = '${jmdict.dictDate}'

export const KANJI_SOURCES: KanjiSourceInfo[] = ${JSON.stringify(sourceInfo, null, 2)}

// the 104 kanji of the set
export const KANJI_SOURCE: Record<string, SourceKanji> = {
${lines(kanjiSource)}
}

// every word of the course and of its groups, by word id
export const WORD_SOURCE: Record<string, SourceWord> = {
${lines(words)}
}

// form:jmdict -> word id, for course entries that don't name a reading
export const DEFAULT_WORD_ID: Record<string, string> = {
${lines(defaultIds)}
}

export const GROUP_SOURCE: Record<string, SourceGroup> = {
${lines(groups)}
}
`)

writeFileSync(new URL('../src/data/kanjiStrokes.ts', import.meta.url), `${header}// This file is under CC BY-SA 3.0. viewBox is 0 0 109 109.
import type { StrokeData } from '../types'

export const KANJI_STROKES: Record<string, StrokeData> = {
${lines(strokes)}
}
`)

console.log(`wrote ${SET.length} kanji, ${Object.keys(words).length} words, ${Object.keys(groups).length} groups`)
if (noSplit.length) console.log(`no split in JmdictFurigana for: ${noSplit.join(', ')}`)
if (missing.length) console.log(`group members JMdict lacks, left out:\n  ${missing.join('\n  ')}`)

if (!withCandidates) process.exit(0)

// --- candidates.md: what the content author picks from ---

// sets as drafted in section 12 of the requirements
const req = readFileSync(new URL('../docs/kanji-requirements.md', import.meta.url), 'utf8')
const draft = req.slice(req.indexOf('## 12.')).split('\n')
  .filter(l => /^\| \d+ \|/.test(l))
  .map(l => l.split('|').map(c => c.trim()))
  .map(c => ({ n: c[1], title: c[2], kanji: c[3].split(/\s+/) }))
const drafted = draft.flatMap(s => s.kanji)
if (drafted.length !== SET.length || SET.some(k => !drafted.includes(k)))
  fail('section 12 of docs/kanji-requirements.md does not list the 104 kanji of the set once each')
const setNo = new Map(draft.flatMap(s => s.kanji.map(k => [k, s.n])))

// KR73, forms only. The counter splits a member into number and counter for the irregular mark,
// which only groups practiced by exception get.
const NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
const nums = (from, to, suffix) => NUM.slice(from - 1, to).map(n => n + suffix)
const GROUP_DRAFT = [
  { title: 'Days of the week', counter: '曜', practice: 'all', members: ['日', '月', '火', '水', '木', '金', '土'].map(d => d + '曜日'), question: '何曜日' },
  { title: 'Counting things', counter: '', practice: 'all', members: [...nums(1, 9, 'つ'), '十'] },
  { title: 'People', counter: '人', practice: 'irregular', members: nums(1, 10, '人'), question: '何人' },
  { title: 'Hundreds', counter: '百', practice: 'irregular', members: ['百', ...nums(2, 9, '百')] },
  { title: 'Thousands', counter: '千', practice: 'irregular', members: ['千', ...nums(2, 9, '千')] },
  { title: 'Hours', counter: '時', practice: 'irregular', members: nums(1, 12, '時'), question: '何時' },
  { title: 'Minutes', counter: '分', practice: 'irregular', members: nums(1, 10, '分'), question: '何分' },
  { title: 'Months', counter: '月', practice: 'irregular', members: nums(1, 12, '月'), question: '何月' },
  { title: 'Days of the month', counter: '日', practice: 'all', members: [...nums(1, 10, '日'), '二十日'], question: '何日' },
]

const mark = irregular => irregular === null ? '?' : irregular ? 'I' : 'R'
const short = (s, n = 60) => s.length > n ? s.slice(0, n - 3) + '...' : s
const fmtSplit = split => split.length === 0 ? 'no split'
  : split.map(p => isKana(p.text[0]) ? p.text : `${p.text}[${p.reading}${p.kind ? '/' + p.kind : ''}]`).join('')

function wordLine(w, form, reading, k) {
  const split = splitOf(form, reading)
  const others = unique([...form].filter(ch => IN_SET.has(ch) && ch !== k)).map(ch => `${ch}(${setNo.get(ch)})`)
  const also = readingsFor(w, form).filter(r => r !== reading)
  return `- ${form} ${w.id} ${reading}${also.length ? ` (also ${also.join(' ')})` : ''}` +
    ` | ${short(glossesFor(w, form, reading)[0] ?? '')} | ${fmtSplit(split)}${isSpecial(split) ? ' SPECIAL' : ''}` +
    ` | ${others.join(' ') || '-'}`
}

// common words outside the N5 list: form and reading both marked common
const others = new Map()
for (const [form, entries] of byForm) {
  for (const w of entries) {
    if (!isCommon(w) || !w.kanji.some(f => f.text === form && f.common)) continue
    const reading = kanaFor(w, form).find(r => r.common)
    if (!reading || inN5(form, toHira(reading.text))) continue
    const key = form + '|' + toHira(reading.text)
    if (!others.has(key)) others.set(key, { form, w, reading: toHira(reading.text) })
  }
}
const otherList = [...others.values()].sort((a, b) => [...a.form].length - [...b.form].length || a.w.id - b.w.id)

const out = [
  '# Kanji candidates',
  '',
  `Generated by scripts/extract-kanji.mjs --candidates from KANJIDIC2/JMdict ${JMDICT_TAG}, JmdictFurigana ${FURIGANA_TAG},`,
  `KanjiVG ${KANJIVG_TAG}, N5 list ${N5_COMMIT.slice(0, 8)}. Do not edit, rerun the script.`,
  '',
  'Word line: form, JMdict id, shown reading (other readings of the entry), first sense, split with on/kun,',
  'SPECIAL when one reading spans several kanji, other set kanji in the word with their set number.',
  'Kanji readings: kun with a dot before the okurigana.',
  '',
]
for (const s of draft) {
  out.push(`## Set ${s.n}: ${s.title}`, '')
  for (const k of s.kanji) {
    const src = kanjiSource[k]
    out.push(`### ${k}  strokes ${src.strokes} | ${src.meanings.join('; ')} | on ${src.on.join(' ') || '-'} | kun ${src.kun.join(' ') || '-'}` +
      ` | parts ${src.parts.map(p => `${p}(${setNo.get(p)})`).join(' ') || '-'} | N5 readings ${src.n5Readings.join(' ') || '-'}`)
    const n5 = n5Words.filter(nw => nw.form.includes(k))
    out.push(`N5 (${n5.length}):`)
    for (const nw of n5) for (const w of nw.entries) out.push(wordLine(w, nw.form, nw.reading, k))
    const more = otherList.filter(o => o.form.includes(k))
    out.push(`Other common (${Math.min(more.length, 25)} of ${more.length}${more.length > 25 ? `, ${more.length - 25} cut` : ''}):`)
    for (const o of more.slice(0, 25)) out.push(wordLine(o.w, o.form, o.reading, k))
    out.push('')
  }
}

const numberKanji = new Set(GROUP_DRAFT.filter(g => g.practice === 'irregular')
  .flatMap(g => g.members.flatMap(form => [...numberPart(form, g.counter)])))
out.push('## Word groups (KR73), full JMdict', '',
  'Member: id shown reading, R regular or I irregular, c common entry. Missing: no JMdict entry with that form.',
  'Marks exist only for groups practiced by exception (practice irregular). Groups practiced in full',
  '(weekdays, counting things, days of the month) and question words get none (-).',
  'R means: the number read the way its kanji read as words of their own in the course, then a common reading of the rest.',
  '? means: a kanji of the number has no word of its own in the course yet.',
  `Number readings from the course now: ${[...ownReading].filter(([k]) => numberKanji.has(k)).map(([k, r]) => `${k} ${r}`).join(', ') || 'none'}`, '')
for (const g of GROUP_DRAFT) {
  out.push(`### ${g.title}, counter ${g.counter || 'none'}, practiced ${g.practice === 'all' ? 'in full' : 'by exception'}`)
  const lacking = []
  for (const form of [...g.members, g.question].filter(Boolean)) {
    const entries = byForm.get(form) ?? []
    if (entries.length === 0) { lacking.push(form); continue }
    const found = entries.map(w => {
      const reading = shownReading(w, form, undefined, `group ${g.title}`)
      const also = readingsFor(w, form).filter(r => r !== reading)
      return `${w.id} ${reading}${also.length ? ` (also ${also.join(' ')})` : ''} ${form === g.question || g.practice === 'all' ? '-' : mark(isIrregular(form, reading, g.counter))}${isCommon(w) ? ' c' : ''}`
    })
    out.push(`- ${form}${form === g.question ? ' (question)' : ''}: ${found.join(' | ')}`)
  }
  out.push(`Missing: ${lacking.join(' ') || 'none'}`, '')
}

out.push('## N5 rows with counters or alternative spellings', '')
for (const [expression, reading, meaning] of n5Rows) {
  const plain = expression.replace(/[～〜]/g, '')
  const counter = plain !== expression && plain.split(/;\s*/).every(f => setOnly(f))
  const alternative = expression.includes(';') && setOnly(expression.split(/;\s*/)[0])
  if (counter || alternative) out.push(`- ${expression} | ${reading} | ${short(meaning)}`)
}

writeFileSync(new URL('candidates.md', CACHE), out.join('\n') + '\n')
console.log(`wrote scripts/.cache/candidates.md, ${out.length} lines`)
