import { HIRAGANA, KATAKANA, kanaInfo } from './kana'

// One line per basic kana: a picture for the shape, tied to the sound.
// Dakuten and combination kana are built from these, see mnemonicFor.
const MNEMONICS: Record<string, string> = {
  // hiragana
  'あ': 'A cross with a loop swinging round it, an apple on a stick: a',
  'い': 'Two short strokes side by side, two eels: ee (i)',
  'う': 'A dot over a hook, someone bending down to say ooh (u)',
  'え': 'A dot over a zigzag that kicks out a leg: eh! (e)',
  'お': 'Like あ, but the little tick flies off to the right: oh! (o)',
  'か': 'A blade and a cut beside it, a karate chop: ka',
  'き': 'Two bars on a hooked stem, a key with two teeth: ki',
  'く': 'A beak opening to the left, a pigeon going coo: ku',
  'け': 'A post next to a cross with a long leg, a keg on a stand: ke',
  'こ': 'Two short lines facing each other, two coins on edge: ko',
  'さ': 'One bar, and a stroke that curls into a cup below, a saucer: sa',
  'し': 'One long hook, a shiny fishhook: shi',
  'す': 'A bar with a loop hanging down, a swing on a branch: su',
  'せ': 'A bar on two posts, the right one folding back, a seesaw: se',
  'そ': 'A zig, a zag and a long curve, thread being sewn: so',
  'た': 'A cross with こ next to it, a table with two plates: ta',
  'ち': 'A bar over a curve that looks like a 5, cheese for five: chi',
  'つ': 'One big wave, a tsunami: tsu',
  'て': 'One stroke reaching out and curving down, a hand (手 is te): te',
  'と': 'A small thorn leaning on a curve, a toe with a splinter: to',
  'な': 'A cross with a knot tied below it: na',
  'に': 'A post next to two short lines, someone on one knee: ni',
  'ぬ': 'Crossed noodles with a curl at the end: nu. め has no curl',
  'ね': 'A post and a loop, a cat curling its tail (猫 neko): ne',
  'の': 'One swirl, like a no entry sign: no',
  'は': 'A post next to a cross with a loop, someone laughing ha with a hand up: ha',
  'ひ': 'A wide grin, hee hee: hi',
  'ふ': 'Four strokes scattered round a center, a face blowing phew: fu',
  'へ': 'One pointed hill, heading up the mountain: he',
  'ほ': 'Like は with a second bar, a house with two floors: ho',
  'ま': 'Two bars down a mast into a loop, a mast with sails: ma',
  'み': 'A loop with a long tail and a cross stroke, a medal on a ribbon: mi',
  'む': 'A loop with a horn ticked on the right, a cow going moo: mu',
  'め': 'Two crossing strokes forming an eye (目 me): me. ぬ adds a curl',
  'も': 'A fishhook with two bars, catching more fish: mo',
  'や': 'A curved bar with two strokes, a yak with horns: ya',
  'ゆ': 'A curl split by a line, a U-turn with the road through it: yu',
  'よ': 'A post with a bar and a loop at the foot, a yo-yo hanging down: yo',
  'ら': 'A dot over a hooked stroke, a rabbit hopping off: ra',
  'り': 'Two strokes, the right one long, reeds by a river: ri',
  'る': 'A zig that ends in a loop, a looped ruby necklace: ru. ろ has no loop',
  'れ': 'A post with a leg kicking out to the right, a referee kicking off: re',
  'ろ': 'Like る but open at the end, an open road: ro',
  'わ': 'A post with a curl rolling inward, a wave coming in: wa',
  'を': 'A bar, a zig and a curve, someone wobbling on a bike, whoa: wo',
  'ん': 'One stroke with a tail, an n written in one go: n',
  // katakana
  'ア': 'A hook with a short stroke under it, an axe: a',
  'イ': 'A slash leaning on a post, an easel: i',
  'ウ': 'Like う with a roof on top, a house going ooh: u',
  'エ': 'An I-beam lying flat, an elevator shaft: e',
  'オ': 'A cross with a slash, an opera singer with arms out: o',
  'カ': 'Like か without the cut, a karate kick: ka',
  'キ': 'Two bars across a post, a key: ki',
  'ク': 'A hook with a short cap, a cook with a hat: ku',
  'ケ': 'A slash, a bar and a drop, a kettle pouring: ke',
  'コ': 'An open box, a corner: ko. ロ is closed',
  'サ': 'A bar on two posts, the right one bending, a saddle: sa',
  'シ': 'Two flat dashes and a stroke sweeping up from below, she smiles: shi. ツ falls from the top',
  'ス': 'A bent stroke with a leg kicking out, a sumo stance: su',
  'セ': 'A bar with a post that folds back, like せ: se',
  'ソ': 'Two strokes coming down from the top, a needle sewing: so. ン sweeps up',
  'タ': 'Like ク with a stroke inside, a taco filled up: ta',
  'チ': 'A tilted cap, a bar and a hook, a cheerleader: chi',
  'ツ': 'Two upright dashes and a stroke falling from the top, a tsunami pouring down: tsu',
  'テ': 'Two bars on a leg, a telescope on a stand: te',
  'ト': 'A post with a branch sticking out, a totem pole: to',
  'ナ': 'A cross with a long sweep, a nail: na',
  'ニ': 'Two lines, like に without the post: ni',
  'ヌ': 'Like ス with a short slash across, noodles with chopsticks: nu',
  'ネ': 'A dot over a cross with legs, a necktie: ne',
  'ノ': 'One slash, the line through a no sign: no',
  'ハ': 'Two strokes spreading apart, a mouth opening to laugh ha: ha',
  'ヒ': 'A bar and a hooked post, a heel: hi',
  'フ': 'One bent stroke, a hood: fu',
  'ヘ': 'Same as へ, one hill, heading up: he',
  'ホ': 'A cross with two dots at the feet, a holy cross: ho',
  'マ': 'One bent top stroke with a tick, a mama\'s face: ma',
  'ミ': 'Three slanted dashes, three mice: mi',
  'ム': 'A triangle with a tail, a cow\'s nose going moo: mu',
  'メ': 'Two crossing strokes, X marks me: me',
  'モ': 'Two bars and a hook, like も without the loop: mo',
  'ヤ': 'A bent bar crossed by a stroke, a yak horn: ya',
  'ユ': 'A box on its side with a long floor, a U-turn: yu',
  'ヨ': 'Three bars and a back, a yoga mat folded: yo',
  'ラ': 'A short bar over a hook, a rapper\'s cap: ra',
  'リ': 'Like り, two reeds: ri',
  'ル': 'Two strokes, the right one kicking up, a root splitting: ru',
  'レ': 'One stroke with a kick up, a leg: re',
  'ロ': 'A closed box, a room: ro',
  'ワ': 'A post with a roof bending down, a water tap: wa',
  'ヲ': 'Like フ with an extra bar, whoa: wo',
  'ン': 'A dash and a stroke sweeping up from below, n: n. ソ comes down from the top',
}

// dakuten rows and the plain row they are built on
const BASE_ROW: Record<string, string> = { ga: 'ka', za: 'sa', da: 'ta', ba: 'ha', pa: 'ha', GA: 'KA', ZA: 'SA', DA: 'TA', BA: 'HA', PA: 'HA' }

function baseOf(kana: string): string | undefined {
  const info = kanaInfo(kana)
  if (!info) return undefined
  const table = info.pair.script === 'hiragana' ? HIRAGANA : KATAKANA
  const row = table.dakuten.find(c => c.id === info.colId)
  const base = table.main.find(c => c.id === BASE_ROW[info.colId])
  if (!row || !base) return undefined
  return base.kana[row.kana.indexOf(kana)]
}

/** A memory hook for any kana, or null when there is none. */
export function mnemonicFor(kana: string): string | null {
  if (MNEMONICS[kana]) return MNEMONICS[kana]
  const info = kanaInfo(kana)
  if (!info) return null
  if (info.group === 'dakuten') {
    const base = baseOf(kana)
    if (!base) return null
    const marks = info.colId.toLowerCase() === 'pa' ? 'the little circle turns h into p' : 'the two ticks make the sound voiced'
    return `${base} (${kanaInfo(base)!.pair.romaji}) plus marks: ${marks}, ${info.pair.romaji}`
  }
  if (info.group === 'combo') {
    const [base, small] = [...kana]
    return `${base} (${kanaInfo(base)?.pair.romaji}) with a small ${small} glides together: ${info.pair.romaji}`
  }
  return null
}
