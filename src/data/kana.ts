import type { KanaData, KanaPair, ScriptName } from '../types'

export const HIRAGANA: KanaData = {
  main: [
    { id:'a',   label:'あ行', sample:'あ', kana:['あ','い','う','え','お'],   romaji:['a','i','u','e','o'] },
    { id:'ka',  label:'か行', sample:'か', kana:['か','き','く','け','こ'],   romaji:['ka','ki','ku','ke','ko'] },
    { id:'sa',  label:'さ行', sample:'さ', kana:['さ','し','す','せ','そ'],   romaji:['sa','shi','su','se','so'] },
    { id:'ta',  label:'た行', sample:'た', kana:['た','ち','つ','て','と'],   romaji:['ta','chi','tsu','te','to'] },
    { id:'na',  label:'な行', sample:'な', kana:['な','に','ぬ','ね','の'],   romaji:['na','ni','nu','ne','no'] },
    { id:'ha',  label:'は行', sample:'は', kana:['は','ひ','ふ','へ','ほ'],   romaji:['ha','hi','fu','he','ho'] },
    { id:'ma',  label:'ま行', sample:'ま', kana:['ま','み','む','め','も'],   romaji:['ma','mi','mu','me','mo'] },
    { id:'ya',  label:'や行', sample:'や', kana:['や','ゆ','よ'],             romaji:['ya','yu','yo'] },
    { id:'ra',  label:'ら行', sample:'ら', kana:['ら','り','る','れ','ろ'],   romaji:['ra','ri','ru','re','ro'] },
    { id:'wa',  label:'わ行', sample:'わ', kana:['わ','を','ん'],             romaji:['wa','wo','n'] },
  ],
  dakuten: [
    { id:'ga',  label:'が行', sample:'が', kana:['が','ぎ','ぐ','げ','ご'],   romaji:['ga','gi','gu','ge','go'] },
    { id:'za',  label:'ざ行', sample:'ざ', kana:['ざ','じ','ず','ぜ','ぞ'],   romaji:['za','ji','zu','ze','zo'] },
    { id:'da',  label:'だ行', sample:'だ', kana:['だ','ぢ','づ','で','ど'],   romaji:['da','di','du','de','do'] },
    { id:'ba',  label:'ば行', sample:'ば', kana:['ば','び','ぶ','べ','ぼ'],   romaji:['ba','bi','bu','be','bo'] },
    { id:'pa',  label:'ぱ行', sample:'ぱ', kana:['ぱ','ぴ','ぷ','ぺ','ぽ'],   romaji:['pa','pi','pu','pe','po'] },
  ],
  combo: [
    { id:'kya', label:'きゃ', sample:'きゃ', kana:['きゃ','きゅ','きょ'], romaji:['kya','kyu','kyo'] },
    { id:'sha', label:'しゃ', sample:'しゃ', kana:['しゃ','しゅ','しょ'], romaji:['sha','shu','sho'] },
    { id:'cha', label:'ちゃ', sample:'ちゃ', kana:['ちゃ','ちゅ','ちょ'], romaji:['cha','chu','cho'] },
    { id:'nya', label:'にゃ', sample:'にゃ', kana:['にゃ','にゅ','にょ'], romaji:['nya','nyu','nyo'] },
    { id:'hya', label:'ひゃ', sample:'ひゃ', kana:['ひゃ','ひゅ','ひょ'], romaji:['hya','hyu','hyo'] },
    { id:'mya', label:'みゃ', sample:'みゃ', kana:['みゃ','みゅ','みょ'], romaji:['mya','myu','myo'] },
    { id:'rya', label:'りゃ', sample:'りゃ', kana:['りゃ','りゅ','りょ'], romaji:['rya','ryu','ryo'] },
    { id:'gya', label:'ぎゃ', sample:'ぎゃ', kana:['ぎゃ','ぎゅ','ぎょ'], romaji:['gya','gyu','gyo'] },
    { id:'ja',  label:'じゃ', sample:'じゃ', kana:['じゃ','じゅ','じょ'], romaji:['ja','ju','jo'] },
    { id:'bya', label:'びゃ', sample:'びゃ', kana:['びゃ','びゅ','びょ'], romaji:['bya','byu','byo'] },
    { id:'pya', label:'ぴゃ', sample:'ぴゃ', kana:['ぴゃ','ぴゅ','ぴょ'], romaji:['pya','pyu','pyo'] },
  ],
}

export const KATAKANA: KanaData = {
  main: [
    { id:'A',   label:'ア行', sample:'ア', kana:['ア','イ','ウ','エ','オ'],   romaji:['a','i','u','e','o'] },
    { id:'KA',  label:'カ行', sample:'カ', kana:['カ','キ','ク','ケ','コ'],   romaji:['ka','ki','ku','ke','ko'] },
    { id:'SA',  label:'サ行', sample:'サ', kana:['サ','シ','ス','セ','ソ'],   romaji:['sa','shi','su','se','so'] },
    { id:'TA',  label:'タ行', sample:'タ', kana:['タ','チ','ツ','テ','ト'],   romaji:['ta','chi','tsu','te','to'] },
    { id:'NA',  label:'ナ行', sample:'ナ', kana:['ナ','ニ','ヌ','ネ','ノ'],   romaji:['na','ni','nu','ne','no'] },
    { id:'HA',  label:'ハ行', sample:'ハ', kana:['ハ','ヒ','フ','ヘ','ホ'],   romaji:['ha','hi','fu','he','ho'] },
    { id:'MA',  label:'マ行', sample:'マ', kana:['マ','ミ','ム','メ','モ'],   romaji:['ma','mi','mu','me','mo'] },
    { id:'YA',  label:'ヤ行', sample:'ヤ', kana:['ヤ','ユ','ヨ'],             romaji:['ya','yu','yo'] },
    { id:'RA',  label:'ラ行', sample:'ラ', kana:['ラ','リ','ル','レ','ロ'],   romaji:['ra','ri','ru','re','ro'] },
    { id:'WA',  label:'ワ行', sample:'ワ', kana:['ワ','ヲ','ン'],             romaji:['wa','wo','n'] },
  ],
  dakuten: [
    { id:'GA',  label:'ガ行', sample:'ガ', kana:['ガ','ギ','グ','ゲ','ゴ'],   romaji:['ga','gi','gu','ge','go'] },
    { id:'ZA',  label:'ザ行', sample:'ザ', kana:['ザ','ジ','ズ','ゼ','ゾ'],   romaji:['za','ji','zu','ze','zo'] },
    { id:'DA',  label:'ダ行', sample:'ダ', kana:['ダ','ヂ','ヅ','デ','ド'],   romaji:['da','di','du','de','do'] },
    { id:'BA',  label:'バ行', sample:'バ', kana:['バ','ビ','ブ','ベ','ボ'],   romaji:['ba','bi','bu','be','bo'] },
    { id:'PA',  label:'パ行', sample:'パ', kana:['パ','ピ','プ','ペ','ポ'],   romaji:['pa','pi','pu','pe','po'] },
  ],
  combo: [
    { id:'KYA', label:'キャ', sample:'キャ', kana:['キャ','キュ','キョ'], romaji:['kya','kyu','kyo'] },
    { id:'SHA', label:'シャ', sample:'シャ', kana:['シャ','シュ','ショ'], romaji:['sha','shu','sho'] },
    { id:'CHA', label:'チャ', sample:'チャ', kana:['チャ','チュ','チョ'], romaji:['cha','chu','cho'] },
    { id:'NYA', label:'ニャ', sample:'ニャ', kana:['ニャ','ニュ','ニョ'], romaji:['nya','nyu','nyo'] },
    { id:'HYA', label:'ヒャ', sample:'ヒャ', kana:['ヒャ','ヒュ','ヒョ'], romaji:['hya','hyu','hyo'] },
    { id:'MYA', label:'ミャ', sample:'ミャ', kana:['ミャ','ミュ','ミョ'], romaji:['mya','myu','myo'] },
    { id:'RYA', label:'リャ', sample:'リャ', kana:['リャ','リュ','リョ'], romaji:['rya','ryu','ryo'] },
    { id:'GYA', label:'ギャ', sample:'ギャ', kana:['ギャ','ギュ','ギョ'], romaji:['gya','gyu','gyo'] },
    { id:'JA',  label:'ジャ', sample:'ジャ', kana:['ジャ','ジュ','ジョ'], romaji:['ja','ju','jo'] },
    { id:'BYA', label:'ビャ', sample:'ビャ', kana:['ビャ','ビュ','ビョ'], romaji:['bya','byu','byo'] },
    { id:'PYA', label:'ピャ', sample:'ピャ', kana:['ピャ','ピュ','ピョ'], romaji:['pya','pyu','pyo'] },
  ],
}

export const GROUP_NAMES: Record<string, string> = {
  main: 'Main Kana (清音)',
  dakuten: 'Dakuten / Handakuten (濁音・半濁音)',
  combo: 'Combination Kana (拗音)',
}

export function allPairs(): KanaPair[] {
  const pairs: KanaPair[] = []
  const add = (data: KanaData, script: ScriptName) => {
    for (const cols of Object.values(data))
      for (const col of cols)
        col.kana.forEach((k, i) => pairs.push({ kana: k, romaji: col.romaji[i], script }))
  }
  add(HIRAGANA, 'hiragana')
  add(KATAKANA, 'katakana')
  return pairs
}
