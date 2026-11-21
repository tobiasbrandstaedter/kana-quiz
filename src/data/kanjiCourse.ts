// The kanji course, written by hand: sets and their order, keywords, words, memory hooks,
// word groups, lookalikes. It holds no readings and no meanings of its own beyond the
// short gloss, those come from src/data/kanjiSource.ts. Pick words and ids out of
// scripts/.cache/candidates.md (node scripts/extract-kanji.mjs --candidates), then rerun
// the script and the tests. Code reads all of this through kanjiData.ts.
//
// A word belongs to the kanji in it that comes last in the order, so moving a kanji can
// move words. The first word of a kanji is the first thing the learner reads with it.
// `reading` is only set to pick between readings one JMdict entry has for the form.
import type { CourseGroup, CourseSet, KanjiLookalikeGroup } from '../types'

export const KANJI_SETS: CourseSet[] = [
  {
    id: 'numbers-1',
    title: 'Numbers 1 to 5',
    kanji: [
      {
        kanji: '一', keyword: 'one',
        hook: 'One flat stroke: one',
        words: [{ form: '一', jmdict: '1160790', gloss: 'one' }],
      },
      {
        kanji: '二', keyword: 'two',
        hook: 'Two strokes, the lower one longer: two',
        words: [{ form: '二', jmdict: '1461140', gloss: 'two' }],
      },
      {
        kanji: '三', keyword: 'three',
        hook: 'Three strokes stacked: three',
        words: [{ form: '三', jmdict: '1579350', gloss: 'three' }],
      },
      {
        kanji: '四', keyword: 'four',
        hook: 'A box with two strokes hanging inside like curtains, a window with its four corners: four',
        // the group marks build on this reading: 四百 and 四千 come out regular, 四月 does not
        words: [{
          form: '四', jmdict: '1579470', reading: 'よん', gloss: 'four',
          why: 'the N5 list has the other reading, this is the one in 四十, 四百 and 四千',
        }],
      },
      {
        kanji: '五', keyword: 'five', parts: ['二'],
        hook: 'Two bars like 二 with two strokes standing between them: five',
        words: [{ form: '五', jmdict: '1268060', gloss: 'five' }],
      },
    ],
  },
  {
    id: 'numbers-2',
    title: 'Numbers 6 to 10',
    kanji: [
      {
        kanji: '六', keyword: 'six',
        hook: 'A dot and a bar on top, two legs spreading below: six',
        words: [{ form: '六', jmdict: '1585310', gloss: 'six' }],
      },
      {
        kanji: '七', keyword: 'seven',
        hook: 'One bar cut by a stroke that bends off to the right. Turn it on its head and it looks like a 7: seven',
        // same as for 四: 七百 and 七千 come out regular, 七月 and 七時 do not
        words: [{
          form: '七', jmdict: '1319210', reading: 'なな', gloss: 'seven',
          why: 'the N5 list has the other reading, this is the one in 七つ and 七百',
        }],
      },
      {
        kanji: '八', keyword: 'eight',
        hook: 'Two strokes leaning apart without touching, wide at the bottom: eight',
        words: [{ form: '八', jmdict: '1583090', gloss: 'eight' }],
      },
      {
        kanji: '九', keyword: 'nine',
        hook: 'One stroke sweeping down to the left, one bending round into a hook on the right: nine',
        words: [{ form: '九', jmdict: '1578150', gloss: 'nine' }],
      },
      {
        kanji: '十', keyword: 'ten',
        hook: 'One bar and one upright, a plain cross: ten',
        words: [
          { form: '十', jmdict: '1579840', gloss: 'ten' },
          { form: '十一', jmdict: '1334470', gloss: 'eleven', why: 'shows how 11 to 19 are built' },
          { form: '二十', jmdict: '1462000', gloss: 'twenty', why: 'shows how the tens are built' },
        ],
      },
    ],
  },
  {
    id: 'big-numbers',
    title: 'Big numbers and money',
    kanji: [
      {
        kanji: '百', keyword: 'hundred',
        hook: 'A bar, a short tick and a box split in two. Read it top down as a 1 and two zeros: hundred',
        words: [{ form: '百', jmdict: '1488000', gloss: 'hundred' }],
      },
      {
        kanji: '千', keyword: 'thousand', parts: ['十'],
        hook: '十 with one slanted stroke on top, ten with a hat on and grown a hundred times: thousand',
        words: [{ form: '千', jmdict: '1388740', gloss: 'thousand' }],
      },
      {
        kanji: '万', keyword: 'ten thousand',
        hook: 'Only three strokes for a huge number, a bar, a hook under it and a sweep to the left: ten thousand',
        words: [{ form: '万', jmdict: '1584460', gloss: 'ten thousand' }],
      },
      {
        kanji: '円', keyword: 'yen',
        hook: 'A frame open at the bottom with an upright and a cross bar inside, a shop window with the price in it: yen',
        words: [{ form: '円', jmdict: '1175570', gloss: 'yen', why: 'N5 has it only as a counter (～円)' }],
      },
    ],
  },
  {
    id: 'elements',
    title: 'Sun, moon and elements',
    kanji: [
      {
        kanji: '日', keyword: 'day',
        hook: 'A box with a bar across the middle, the sun in a window. One sun, one day: day',
        words: [
          { form: '日', jmdict: '1463770', gloss: 'day, sun', why: 'the kanji as a word, N5 has it only inside other words' },
          { form: '一日', jmdict: '1576260', gloss: 'one day' },
        ],
      },
      {
        kanji: '月', keyword: 'month',
        hook: 'Two bars in a frame that stands on two open legs, the moon. One moon, one month: month',
        words: [{ form: '月', jmdict: '1255430', gloss: 'moon, month', why: 'the kanji as a word, N5 has it only inside other words' }],
      },
      {
        kanji: '火', keyword: 'fire',
        hook: 'A tall flame that forks in two, with a spark flying off on each side: fire',
        words: [{ form: '火', jmdict: '1193610', gloss: 'fire', why: 'the kanji as a word, its N5 word 火曜日 comes with the weekdays' }],
      },
      {
        kanji: '水', keyword: 'water',
        hook: 'One hooked upright in the middle and water splashing off to both sides: water',
        words: [{ form: '水', jmdict: '1371260', gloss: 'water' }],
      },
      {
        kanji: '木', keyword: 'tree',
        hook: 'A trunk, a bar for the branches and two roots spreading out: tree',
        words: [{ form: '木', jmdict: '1534520', gloss: 'tree' }],
      },
      {
        kanji: '金', keyword: 'gold',
        hook: 'A roof, and under it bars with two small dots between them, nuggets kept safe: gold',
        words: [{ form: 'お金', jmdict: '1001820', gloss: 'money' }],
      },
      {
        kanji: '土', keyword: 'soil',
        hook: 'A cross standing on a long bar, a sprout pushing out of the ground: soil',
        words: [{ form: '土', jmdict: '1445270', gloss: 'soil, earth', why: 'the kanji as a word, its N5 word 土曜日 comes with the weekdays' }],
      },
    ],
  },
  {
    id: 'people',
    title: 'People',
    kanji: [
      {
        kanji: '人', keyword: 'person',
        hook: 'Two strokes leaning on each other, a person walking: person',
        words: [{ form: '人', jmdict: '1580640', gloss: 'person' }],
      },
      {
        kanji: '男', keyword: 'male',
        hook: 'A field split in four on top and a strong bent arm below, the one who works the field: male',
        words: [{ form: '男', jmdict: '1419990', gloss: 'man' }],
      },
      {
        kanji: '女', keyword: 'female',
        hook: 'Three strokes crossing, a figure kneeling with arms held out: female',
        words: [{ form: '女', jmdict: '1344930', gloss: 'woman' }],
      },
      {
        kanji: '子', keyword: 'child',
        hook: 'A small head, one bar for the arms stretched out and a hooked body, a baby in a blanket: child',
        words: [
          { form: '子ども', jmdict: '1307850', gloss: 'child', why: 'too common to miss, the everyday word for child' },
          { form: '男の子', jmdict: '1420010', gloss: 'boy' },
          { form: '女の子', jmdict: '1344970', gloss: 'girl' },
        ],
      },
      {
        kanji: '父', keyword: 'father',
        hook: 'Two short strokes on top, two long ones crossing below like folded arms: father',
        words: [
          { form: '父', jmdict: '1497610', gloss: 'father' },
          { form: 'お父さん', jmdict: '1002590', gloss: 'father, dad' },
        ],
      },
      {
        kanji: '母', keyword: 'mother',
        hook: 'A tilted frame with two dots inside, a mother holding two little ones: mother',
        words: [
          { form: '母', jmdict: '1514990', gloss: 'mother' },
          { form: 'お母さん', jmdict: '1002650', gloss: 'mother, mom' },
        ],
      },
      {
        kanji: '友', keyword: 'friend',
        hook: 'Two crossing shapes, one above the other, two hands reaching for each other: friend',
        words: [{ form: '友だち', jmdict: '1540170', gloss: 'friend', why: 'no N5 word for 友 in these kanji, this is the everyday one' }],
      },
    ],
  },
  {
    id: 'body',
    title: 'Body',
    kanji: [
      {
        kanji: '口', keyword: 'mouth',
        hook: 'A square opening: mouth',
        words: [{ form: '口', jmdict: '1275640', gloss: 'mouth' }],
      },
      {
        kanji: '目', keyword: 'eye',
        hook: 'A tall box with two bars inside, an eye stood on end: eye',
        words: [{ form: '目', jmdict: '1604890', gloss: 'eye' }],
      },
      {
        kanji: '耳', keyword: 'ear',
        hook: 'Like 目, but its lines stick out past the box at the top and the bottom, the way an ear sticks out: ear',
        words: [{ form: '耳', jmdict: '1317170', gloss: 'ear' }],
      },
      {
        kanji: '手', keyword: 'hand',
        hook: 'A hooked stem with two bars across it and a slanted stroke on top, the lines of an open palm: hand',
        words: [{ form: '手', jmdict: '1327190', gloss: 'hand' }],
      },
      {
        kanji: '足', keyword: 'foot', parts: ['口'],
        hook: 'A 口 on top like a kneecap, and below it strokes striding off: foot',
        words: [{ form: '足', jmdict: '1404630', gloss: 'foot, leg' }],
      },
    ],
  },
  {
    // 少 right after 小, which it is built from and looks like, then its opposite 多
    id: 'describing',
    title: 'Describing things',
    kanji: [
      {
        kanji: '大', keyword: 'big',
        hook: '人 with a bar across, a person with arms spread wide: big',
        words: [
          { form: '大きい', jmdict: '1588880', gloss: 'big' },
          { form: '大人', jmdict: '1414170', gloss: 'adult' },
        ],
      },
      {
        kanji: '小', keyword: 'small',
        hook: 'A hooked upright with a small stroke on each side, arms kept close to the body: small',
        words: [{ form: '小さい', jmdict: '1347750', gloss: 'small' }],
      },
      {
        kanji: '少', keyword: 'few', parts: ['小'],
        hook: '小 with a long stroke slicing under it. Cut something small and only a few bits are left: few',
        words: [
          { form: '少ない', jmdict: '1348910', gloss: 'few' },
          { form: '少し', jmdict: '1348870', gloss: 'a little' },
        ],
      },
      {
        kanji: '多', keyword: 'many',
        hook: 'The same three stroke shape twice, one on top of the other. Things pile up: many',
        words: [{ form: '多い', jmdict: '1407460', gloss: 'many' }],
      },
      {
        kanji: '高', keyword: 'tall', parts: ['口'],
        hook: 'A tower with a pointed roof, a 口 as the upper window and a wide frame with another 口 below: tall',
        words: [{ form: '高い', jmdict: '1283190', gloss: 'high, tall, expensive' }],
      },
      {
        kanji: '長', keyword: 'long',
        hook: 'Short bars at the top like a comb, one long bar under them and long strokes flowing out below, long hair: long',
        words: [{ form: '長い', jmdict: '1429750', gloss: 'long' }],
      },
      {
        kanji: '白', keyword: 'white', parts: ['日'],
        hook: '日 with a tick on top, one ray of the sun, bright and white: white',
        words: [
          { form: '白', jmdict: '1474900', gloss: 'white (the color)' },
          { form: '白い', jmdict: '1474910', gloss: 'white' },
        ],
      },
    ],
  },
  {
    // 天 before 気: 天 can stand alone as a word, and 天気 is then the first word of 気
    id: 'nature',
    title: 'Nature',
    kanji: [
      {
        kanji: '山', keyword: 'mountain',
        hook: 'Three peaks on a base line, the middle one highest: mountain',
        words: [{ form: '山', jmdict: '1302680', gloss: 'mountain' }],
      },
      {
        kanji: '川', keyword: 'river',
        hook: 'Three lines running down side by side, water flowing: river',
        words: [{ form: '川', jmdict: '1390020', gloss: 'river' }],
      },
      {
        kanji: '天', keyword: 'heavens', parts: ['大'],
        hook: '大 with a bar on top. Above even the biggest person: heavens',
        words: [{ form: '天', jmdict: '1438210', gloss: 'sky, heaven', why: 'no N5 word for 天 without 気, which comes next' }],
      },
      {
        kanji: '気', keyword: 'spirit',
        hook: 'Three strokes on top, a long line that curls down to a hook and a small x under it, steam rising off a pot like breath: spirit',
        words: [{ form: '天気', jmdict: '1438690', gloss: 'weather', meanings: { 気: 'atmosphere' } }],
      },
      {
        kanji: '雨', keyword: 'rain',
        hook: 'A bar for the sky, a frame like a window and four drops inside: rain',
        words: [{ form: '雨', jmdict: '1171900', gloss: 'rain' }],
      },
      {
        kanji: '空', keyword: 'sky', parts: ['八'],
        hook: 'A roof, and under it two strokes parting like 八 over a beam. Look up through the gap: sky',
        words: [{ form: '空', jmdict: '1245290', gloss: 'sky' }],
      },
      {
        kanji: '花', keyword: 'flower',
        hook: 'On top a bar crossed by two short strokes, like sprouts. Below, a person leaning in to smell: flower',
        words: [{ form: '花', jmdict: '1194500', gloss: 'flower' }],
      },
      {
        kanji: '魚', keyword: 'fish',
        hook: 'A pointed head, a body split in four like scales and four dots for the tail: fish',
        words: [{ form: '魚', jmdict: '1578010', gloss: 'fish' }],
      },
    ],
  },
  {
    id: 'where',
    title: 'Where',
    kanji: [
      {
        kanji: '上', keyword: 'up',
        hook: 'An upright and a short stroke, all of it above the base line: up',
        words: [
          { form: '上', jmdict: '1352130', gloss: 'above, top' },
          { form: '上げる', jmdict: '1352320', gloss: 'to raise' },
          { form: '上手', jmdict: '1353320', gloss: 'skillful' },
        ],
      },
      {
        kanji: '下', keyword: 'down',
        hook: 'An upright and a small stroke, all of it hanging below the top line: down',
        words: [
          { form: '下', jmdict: '1184140', gloss: 'below, under' },
          { form: '下さい', jmdict: '1184270', gloss: 'please (give me)' },
          { form: '下手', jmdict: '1185200', gloss: 'unskillful' },
        ],
      },
      {
        kanji: '中', keyword: 'inside', parts: ['口'],
        hook: 'One upright driven through the middle of a 口, right into it: inside',
        words: [{ form: '中', jmdict: '1423310', gloss: 'inside' }],
      },
      {
        kanji: '外', keyword: 'outside',
        hook: 'On the left one half of 多, on the right the top of 上 without its base line. That part stands off on its own, out in the open: outside',
        words: [{ form: '外', jmdict: '1203250', gloss: 'outside' }],
      },
      {
        kanji: '左', keyword: 'left',
        hook: 'A bar and a long sweep for the arm, and under it a short upright between two bars, a tool. The hand that holds the tool steady: left',
        words: [{ form: '左', jmdict: '1290800', gloss: 'left' }],
      },
      {
        kanji: '右', keyword: 'right', parts: ['口'],
        hook: 'The same arm as in 左, but with a 口 under it. The hand that brings food to the mouth: right',
        words: [{ form: '右', jmdict: '1171010', gloss: 'right' }],
      },
      {
        kanji: '前', keyword: 'in front', parts: ['月'],
        hook: 'Two horns on a bar at the top, and horns go first. Below sit 月 and two upright strokes: in front',
        words: [{ form: '前', jmdict: '1392580', gloss: 'in front, before' }],
      },
      {
        kanji: '後', keyword: 'behind',
        hook: 'A walker on the left, on the right a twist of thread over a dragging foot. Someone slowed down and left at the back: behind',
        words: [
          { form: '後ろ', jmdict: '1269410', gloss: 'back, behind' },
          { form: '後', jmdict: '1269320', gloss: 'after, later', meanings: { 後: 'later' } },
        ],
      },
    ],
  },
  {
    id: 'compass',
    title: 'Compass and country',
    kanji: [
      {
        kanji: '東', keyword: 'east', parts: ['日', '木'],
        hook: '日 caught in the branches of 木, the sun coming up behind a tree: east',
        words: [{ form: '東', jmdict: '1447440', gloss: 'east' }],
      },
      {
        kanji: '西', keyword: 'west',
        hook: 'A box with a lid and two strokes dipping in from above, the sun sinking into its box for the night: west',
        words: [{ form: '西', jmdict: '1380840', gloss: 'west' }],
      },
      {
        kanji: '南', keyword: 'south', parts: ['十'],
        hook: 'A house with a 十 on the roof and a plant growing inside, on the warm side: south',
        words: [{ form: '南', jmdict: '1459870', gloss: 'south' }],
      },
      {
        kanji: '北', keyword: 'north',
        hook: 'Two figures sitting back to back, turning their backs on the cold: north',
        words: [{ form: '北', jmdict: '1520670', gloss: 'north' }],
      },
      {
        kanji: '国', keyword: 'country',
        hook: 'A border drawn all the way round, with a jewel kept safe inside: country',
        words: [
          { form: '国', jmdict: '1592250', gloss: 'country' },
          { form: '外国', jmdict: '1203620', gloss: 'foreign country' },
          { form: '外国人', jmdict: '1203650', gloss: 'foreigner' },
          {
            form: '中国', jmdict: '1424270', gloss: 'China', meanings: { 中: 'middle' },
            why: 'a country name, and the only word here with the on reading of 中',
          },
        ],
      },
    ],
  },
  {
    id: 'clock',
    title: 'Clock',
    kanji: [
      {
        kanji: '時', keyword: 'time', parts: ['日', '土'],
        hook: '日 on the left, the sun that people read the time from. On the right 土 over a bar with a hooked stem and a dot: time',
        words: [{ form: '時', jmdict: '1315840', gloss: 'time, moment', why: 'N5 has it only as a counter (～時)' }],
      },
      {
        kanji: '分', keyword: 'part', parts: ['八'],
        hook: '八 opening up on top, a blade underneath. A knife cuts a thing in pieces, and a minute is a small piece of the hour: part',
        words: [
          {
            form: '分', jmdict: '1502840', gloss: 'minute', meanings: { 分: 'minute of time' },
            why: 'the Clock set needs the minute first, and the minutes group builds on this reading',
          },
          { form: '分かる', jmdict: '1606560', gloss: 'to understand', meanings: { 分: 'understand' } },
          { form: '多分', jmdict: '1407980', gloss: 'probably' },
        ],
      },
      {
        kanji: '半', keyword: 'half',
        hook: 'Two dots, two bars and one upright straight down the middle, cutting it all in two: half',
        words: [
          { form: '半', jmdict: '1478750', gloss: 'half, half past' },
          { form: '半分', jmdict: '1479890', gloss: 'half' },
        ],
      },
      {
        kanji: '間', keyword: 'interval', parts: ['日'],
        hook: 'A gate with two leaves and 日 in the gap, the sun shining through the space between: interval',
        words: [{ form: '時間', jmdict: '1315920', gloss: 'time, hour' }],
      },
      {
        kanji: '今', keyword: 'now',
        hook: 'A roof, a short bar under it and below that a hook like a bent clock hand, showing the time this minute: now',
        words: [
          { form: '今', jmdict: '1288850', gloss: 'now' },
          { form: '今月', jmdict: '1289100', gloss: 'this month' },
          { form: '今日', jmdict: '1579110', gloss: 'today' },
        ],
      },
      {
        kanji: '午', keyword: 'noon', parts: ['十'],
        hook: '十 with a slanted stroke and a bar on top, a clock hand pointing straight up: noon',
        words: [
          { form: '午前', jmdict: '1269060', gloss: 'morning, a.m.', meanings: { 前: 'before' } },
          { form: '午後', jmdict: '1268990', gloss: 'afternoon, p.m.', meanings: { 後: 'later' } },
        ],
      },
    ],
  },
  {
    // 生 before 先, so 先生 can be the first word of 先
    id: 'school',
    title: 'School',
    kanji: [
      {
        kanji: '学', keyword: 'study', parts: ['子'],
        hook: 'A 子 under a roof with three sparks on top, a child whose head is lighting up: study',
        words: [{ form: '大学', jmdict: '1413240', gloss: 'university' }],
      },
      {
        kanji: '校', keyword: 'school', parts: ['木', '父'],
        hook: '木 on the left, a building of wood. On the right 父 under a lid, fathers bringing their children: school',
        words: [{ form: '学校', jmdict: '1206730', gloss: 'school' }],
      },
      {
        kanji: '生', keyword: 'life',
        hook: 'A tick, three bars and a stem, a sprout coming out of the ground: life',
        words: [
          { form: '学生', jmdict: '1206900', gloss: 'student' },
          { form: '生まれる', jmdict: '1378690', gloss: 'to be born', meanings: { 生: 'birth' } },
        ],
      },
      {
        kanji: '先', keyword: 'previous',
        hook: 'Like 生, but on two legs where 生 has its ground bar. The one who walked here before you: previous',
        words: [
          { form: '先生', jmdict: '1387990', gloss: 'teacher', meanings: { 先: 'before', 生: 'birth' } },
          { form: '先月', jmdict: '1387500', gloss: 'last month' },
          { form: '先', jmdict: '1387210', gloss: 'tip, ahead', meanings: { 先: 'ahead' } },
        ],
      },
      {
        kanji: '本', keyword: 'book', parts: ['木'],
        hook: '木 with a short bar across the foot of the trunk. Trees give paper and paper makes books: book',
        words: [
          { form: '本', jmdict: '1522150', gloss: 'book' },
          { form: '日本', jmdict: '1582710', gloss: 'Japan', meanings: { 日: 'sun', 本: 'origin' }, why: 'the name of the country' },
          {
            form: '日本人', jmdict: '1464700', gloss: 'Japanese person', meanings: { 日: 'sun', 本: 'origin' },
            why: 'too useful to miss, 人 read as in 外国人',
          },
        ],
      },
      {
        kanji: '名', keyword: 'name', parts: ['口'],
        hook: 'A 口 under one half of 多, a mouth calling out who you are: name',
        words: [{ form: '名前', jmdict: '1531710', gloss: 'name' }],
      },
      {
        kanji: '何', keyword: 'what', parts: ['人', '口'],
        hook: '人 squeezed in on the left, on the right a 口 inside a hooked frame. A person with an open mouth, asking: what',
        words: [{ form: '何', jmdict: '1577100', gloss: 'what' }],
      },
    ],
  },
  {
    id: 'language',
    title: 'Language',
    kanji: [
      {
        kanji: '言', keyword: 'say', parts: ['口'],
        hook: 'A 口 at the bottom, a dot and three lines above it, words coming out of a mouth: say',
        words: [{ form: '言う', jmdict: '1587040', gloss: 'to say' }],
      },
      {
        kanji: '語', keyword: 'language', parts: ['言', '五', '口'],
        hook: '言 on the left, on the right 五 over 口. Five mouths, each speaking its own: language',
        words: [
          { form: '外国語', jmdict: '1203640', gloss: 'foreign language', why: 'no N5 word for 語, this one builds on 外国' },
          {
            form: '日本語', jmdict: '1464530', gloss: 'Japanese (language)', meanings: { 日: 'sun', 本: 'origin' },
            why: 'the language this course is about',
          },
        ],
      },
      {
        kanji: '話', keyword: 'talk', parts: ['言', '千', '口'],
        hook: '言 on the left, on the right 千 over 口. A thousand words out of one mouth: talk',
        words: [
          { form: '話', jmdict: '1600900', gloss: 'talk, conversation' },
          { form: '話す', jmdict: '1562350', gloss: 'to talk, to speak' },
        ],
      },
      {
        kanji: '読', keyword: 'read', parts: ['言'],
        hook: '言 on the left, the words on the page. On the right a cross on a bar, then a lid and two legs, a reader walking around with a book: read',
        words: [{ form: '読む', jmdict: '1456360', gloss: 'to read' }],
      },
      {
        kanji: '書', keyword: 'write', parts: ['日'],
        hook: 'Bars with one long upright through them, a brush in a hand, held over 日 as the sheet of paper: write',
        words: [{ form: '書く', jmdict: '1343950', gloss: 'to write' }],
      },
      {
        kanji: '聞', keyword: 'hear', parts: ['耳'],
        hook: 'An ear, 耳, at the gate, listening to what goes on inside: hear',
        words: [{ form: '聞く', jmdict: '1591110', gloss: 'to hear, to listen, to ask' }],
      },
      {
        kanji: '見', keyword: 'see', parts: ['目'],
        hook: '目 on two legs, an eye that walks around and looks at things: see',
        words: [
          { form: '見る', jmdict: '1259290', gloss: 'to see, to look' },
          { form: '見せる', jmdict: '1259210', gloss: 'to show' },
        ],
      },
    ],
  },
  {
    id: 'moving',
    title: 'Coming and going',
    kanji: [
      {
        kanji: '行', keyword: 'going',
        hook: 'Two halves like the two sides of a street, a walker on the left and a post on the right. Off you go: going',
        words: [{ form: '行く', jmdict: '1578850', gloss: 'to go' }],
      },
      {
        kanji: '来', keyword: 'come', parts: ['木'],
        hook: 'A 木 with one more bar and two small strokes in the branches, fruit on the tree. When it is ripe, people turn up: come',
        words: [
          { form: '来る', jmdict: '1547720', gloss: 'to come' },
          { form: '来月', jmdict: '1547900', gloss: 'next month', meanings: { 来: 'next' } },
        ],
      },
      {
        kanji: '出', keyword: 'exit', parts: ['山'],
        hook: 'Looks like one 山 standing on another, a peak coming out from behind the first: exit',
        words: [
          { form: '出る', jmdict: '1338240', gloss: 'to leave, to go out' },
          { form: '出口', jmdict: '1338850', gloss: 'exit' },
          { form: '出す', jmdict: '1338180', gloss: 'to take out' },
          { form: '出かける', jmdict: '1598550', gloss: 'to go out (on an outing)' },
        ],
      },
      {
        kanji: '入', keyword: 'enter',
        hook: 'Two strokes like 人, but the long one leans right and covers the short one, a wedge going in: enter',
        words: [
          { form: '入る', jmdict: '1465590', gloss: 'to enter' },
          { form: '入口', jmdict: '1582820', gloss: 'entrance' },
          { form: '入れる', jmdict: '1465610', gloss: 'to put in' },
        ],
      },
      {
        kanji: '立', keyword: 'stand up',
        hook: 'A dot and a bar on top, two short legs and a long ground line, a figure on its feet: stand up',
        words: [{ form: '立つ', jmdict: '1597040', gloss: 'to stand up' }],
      },
      {
        kanji: '会', keyword: 'meet', parts: ['人', '二'],
        hook: 'A roof like a wide 人, and under it 二 and a folded shape. Two people under one roof: meet',
        words: [{ form: '会う', jmdict: '1198180', gloss: 'to meet' }],
      },
      {
        kanji: '休', keyword: 'rest', parts: ['人', '木'],
        hook: '人 leaning against 木, a person taking a break by a tree: rest',
        words: [
          { form: '休み', jmdict: '1227500', gloss: 'rest, holiday' },
          { form: '休む', jmdict: '1227560', gloss: 'to rest, to take a day off' },
        ],
      },
    ],
  },
  {
    id: 'calendar',
    title: 'Calendar',
    kanji: [
      {
        kanji: '年', keyword: 'year',
        hook: 'A tick like the one on 生, three bars with a short upright joining the lower two on the left, and a long pole through them all. One more notch on the pole every year: year',
        words: [
          { form: '年', jmdict: '1468060', gloss: 'year' },
          { form: '来年', jmdict: '1548220', gloss: 'next year', meanings: { 来: 'next' } },
          { form: '今年', jmdict: '1579130', gloss: 'this year' },
        ],
      },
      {
        kanji: '毎', keyword: 'every',
        hook: 'A shape like 母 with a cap of two strokes on top. Mother puts her cap on, morning after morning: every',
        words: [
          { form: '毎日', jmdict: '1524720', gloss: 'every day' },
          { form: '毎月', jmdict: '1584350', reading: 'まいつき', gloss: 'every month' },
          { form: '毎年', jmdict: '1584360', reading: 'まいとし', gloss: 'every year' },
        ],
      },
      {
        kanji: '週', keyword: 'week', parts: ['口'],
        hook: 'A frame packed with 口 and more, riding on a base that sweeps along under it. Seven days, once round: week',
        words: [
          { form: '今週', jmdict: '1289220', gloss: 'this week' },
          { form: '先週', jmdict: '1387870', gloss: 'last week' },
          { form: '来週', jmdict: '1548010', gloss: 'next week', meanings: { 来: 'next' } },
          { form: '毎週', jmdict: '1524690', gloss: 'every week' },
        ],
      },
      {
        kanji: '曜', keyword: 'weekday', parts: ['日'],
        hook: '日 on the left. On the right two small wings, each a hooked frame with two ticks, over a tall bird of many bars. The days fly by, each with a name: weekday',
        words: [{ form: '曜日', jmdict: '1545770', gloss: 'day of the week', why: 'no word for 曜 outside the weekdays, this is their base' }],
      },
    ],
  },
  {
    id: 'shopping',
    title: 'Eating and shopping',
    kanji: [
      {
        kanji: '食', keyword: 'eat',
        hook: 'A roof, and under it a pot with a lid and feet. Dinner is on the table: eat',
        words: [{ form: '食べる', jmdict: '1358280', gloss: 'to eat' }],
      },
      {
        kanji: '飲', keyword: 'drink', parts: ['食'],
        hook: '食 squeezed to the left, its two feet turned into one short tick, and on the right someone leaning in with the mouth wide open: drink',
        words: [{ form: '飲む', jmdict: '1169870', gloss: 'to drink' }],
      },
      {
        kanji: '買', keyword: 'buy', parts: ['目'],
        hook: 'A flat net on top, below it 目 on two short feet that do not touch it, not the long legs of 見. You eye it and into the net it goes: buy',
        words: [{ form: '買う', jmdict: '1473740', gloss: 'to buy' }],
      },
      {
        kanji: '店', keyword: 'store', parts: ['口'],
        hook: 'A building open to the street on one side, and inside a counter, a 口 with a small sign on top: store',
        words: [{ form: '店', jmdict: '1582120', gloss: 'store' }],
      },
      {
        kanji: '安', keyword: 'cheap', parts: ['女'],
        hook: '女 under a roof. Staying in is calm and costs nothing: cheap',
        words: [{ form: '安い', jmdict: '1153670', gloss: 'cheap' }],
      },
      {
        kanji: '古', keyword: 'old', parts: ['十', '口'],
        hook: '十 over 口. A story that has been through ten mouths: old',
        words: [{ form: '古い', jmdict: '1265070', gloss: 'old' }],
      },
      {
        kanji: '新', keyword: 'new', parts: ['立', '木'],
        hook: '立 over 木 on the left, an axe on the right. A standing tree, freshly cut: new',
        words: [
          { form: '新しい', jmdict: '1361490', gloss: 'new' },
          { form: '新聞', jmdict: '1362360', gloss: 'newspaper' },
        ],
      },
    ],
  },
  {
    id: 'town',
    title: 'Town',
    kanji: [
      {
        kanji: '駅', keyword: 'station',
        hook: 'On the left a horse with a mane of bars and four dots for hooves, on the right a long stride. Horse or train, here you get on: station',
        words: [{ form: '駅', jmdict: '1175140', gloss: 'station' }],
      },
      {
        kanji: '道', keyword: 'street', parts: ['目'],
        hook: 'A head, two hairs on a bar and 目 with a tick, carried along on a base that sweeps under it, someone walking down the road: street',
        words: [{ form: '道', jmdict: '1454080', gloss: 'road, street' }],
      },
      {
        kanji: '社', keyword: 'company', parts: ['土'],
        hook: 'On the left a narrow shape, a dot over a bent stroke with an upright and a tick. On the right 土, the ground the firm stands on: company',
        words: [{ form: '会社', jmdict: '1198550', gloss: 'company' }],
      },
      {
        kanji: '車', keyword: 'car',
        hook: 'A cart seen from above, the box in the middle, a wheel on each side and one axle through it all: car',
        words: [{ form: '車', jmdict: '1323080', gloss: 'car' }],
      },
      {
        kanji: '電', keyword: 'electricity', parts: ['雨'],
        hook: '雨 on top, and under the rain a box with a tail that kicks out, a flash coming down: electricity',
        words: [
          { form: '電車', jmdict: '1443530', gloss: 'train' },
          { form: '電気', jmdict: '1443000', gloss: 'electricity, light' },
          { form: '電話', jmdict: '1443840', gloss: 'phone, phone call' },
        ],
      },
    ],
  },
]

// Hours, months, days of the month ... (KR73). The counter is the home kanji of the group.
// A member can be a course word too (百, 千): it shows in the table and is practiced as
// the course word. Thousands: JMdict has no entry for 二千, 五千, 六千 and 九千. 何百 and
// 何千 are no question words, JMdict has them as "hundreds" and "many thousands".
export const WORD_GROUPS: CourseGroup[] = [
  {
    // no counter kanji in these words, the group hangs on 十, the last kanji in it
    id: 'counting-things',
    title: 'Counting things',
    counter: '十',
    practice: 'all',
    members: [
      { form: '一つ', jmdict: '1160820' },
      { form: '二つ', jmdict: '1461160' },
      { form: '三つ', jmdict: '1299740' },
      { form: '四つ', jmdict: '1307040' },
      { form: '五つ', jmdict: '1268070' },
      { form: '六つ', jmdict: '1585315' },
      { form: '七つ', jmdict: '1319220' },
      { form: '八つ', jmdict: '1583095' },
      { form: '九つ', jmdict: '1243600' },
      { form: '十', jmdict: '1579840', reading: 'とお' },
    ],
  },
  {
    id: 'hundreds',
    title: 'Hundreds',
    counter: '百',
    practice: 'irregular',
    members: [
      { form: '百', jmdict: '1488000' },
      { form: '二百', jmdict: '1656380' },
      { form: '三百', jmdict: '1301490' },
      { form: '四百', jmdict: '1767090' },
      { form: '五百', jmdict: '2220390' },
      { form: '六百', jmdict: '2143010' },
      { form: '七百', jmdict: '2220400' },
      { form: '八百', jmdict: '2038570' },
      { form: '九百', jmdict: '2220410' },
    ],
  },
  {
    id: 'thousands',
    title: 'Thousands',
    counter: '千',
    practice: 'irregular',
    members: [
      { form: '千', jmdict: '1388740' },
      { form: '三千', jmdict: '1301110' },
      { form: '四千', jmdict: '1766960' },
      { form: '七千', jmdict: '2839886' },
      { form: '八千', jmdict: '2220420' },
    ],
  },
  {
    id: 'days-of-month',
    title: 'Days of the month',
    counter: '日',
    practice: 'all',
    members: [
      { form: '一日', jmdict: '2225040' },
      { form: '二日', jmdict: '1462900' },
      { form: '三日', jmdict: '1301330' },
      { form: '四日', jmdict: '1307320' },
      { form: '五日', jmdict: '1268570' },
      { form: '六日', jmdict: '1561470' },
      { form: '七日', jmdict: '1579630' },
      { form: '八日', jmdict: '1476920' },
      { form: '九日', jmdict: '1243850' },
      { form: '十日', jmdict: '1335000' },
      { form: '十二日', jmdict: '2736890' },
      { form: '十四日', jmdict: '1629290' },
      { form: '二十日', jmdict: '1600850' },
      { form: '二十四日', jmdict: '1629300' },
    ],
    question: { form: '何日', jmdict: '1189240' },
  },
  {
    id: 'months',
    title: 'Months',
    counter: '月',
    practice: 'irregular',
    members: [
      { form: '一月', jmdict: '1162120' },
      { form: '二月', jmdict: '1461560' },
      { form: '三月', jmdict: '1300250' },
      { form: '四月', jmdict: '1307180' },
      { form: '五月', jmdict: '1268170' },
      { form: '六月', jmdict: '1561330' },
      { form: '七月', jmdict: '1319280' },
      { form: '八月', jmdict: '1476730' },
      { form: '九月', jmdict: '1243660' },
      { form: '十月', jmdict: '1334570' },
      { form: '十一月', jmdict: '1334480' },
      { form: '十二月', jmdict: '1334910' },
    ],
    question: { form: '何月', jmdict: '1188700' },
  },
  {
    id: 'counting-people',
    title: 'Counting people',
    counter: '人',
    practice: 'irregular',
    members: [
      { form: '一人', jmdict: '1576150' },
      { form: '二人', jmdict: '1582670' },
      { form: '三人', jmdict: '1301000' },
      { form: '四人', jmdict: '1985310' },
      { form: '五人', jmdict: '2862879' },
      { form: '六人', jmdict: '2862880' },
      { form: '七人', jmdict: '2862881' },
      { form: '八人', jmdict: '2862882' },
      { form: '九人', jmdict: '2862765' },
      { form: '十人', jmdict: '2862883' },
    ],
    question: { form: '何人', jmdict: '1189100' },
  },
  {
    id: 'hours',
    title: 'Hours',
    counter: '時',
    practice: 'irregular',
    members: [
      { form: '一時', jmdict: '1576100' },
      { form: '二時', jmdict: '2612170' },
      { form: '三時', jmdict: '1300520' },
      { form: '四時', jmdict: '1307230' },
      { form: '五時', jmdict: '2845367' },
      { form: '六時', jmdict: '2583620' },
      { form: '七時', jmdict: '2845363' },
      { form: '八時', jmdict: '2845368' },
      { form: '九時', jmdict: '2845349' },
      { form: '十時', jmdict: '2845369' },
      { form: '十一時', jmdict: '2845370' },
      { form: '十二時', jmdict: '1334960' },
    ],
    question: { form: '何時', jmdict: '1188770' },
  },
  {
    id: 'minutes',
    title: 'Minutes',
    counter: '分',
    practice: 'irregular',
    members: [
      { form: '一分', jmdict: '1166290' },
      { form: '二分', jmdict: '2219180' },
      { form: '三分', jmdict: '1814040' },
      { form: '四分', jmdict: '2863218' },
      { form: '五分', jmdict: '2039350' },
      { form: '六分', jmdict: '2056150' },
      { form: '七分', jmdict: '2864067' },
      { form: '八分', jmdict: '2038580' },
      { form: '九分', jmdict: '2864068' },
      { form: '十分', jmdict: '1335070' },
    ],
    question: { form: '何分', jmdict: '1189320' },
  },
  {
    id: 'weekdays',
    title: 'Days of the week',
    counter: '曜',
    practice: 'all',
    members: [
      { form: '日曜日', jmdict: '1464900' },
      { form: '月曜日', jmdict: '1255890' },
      { form: '火曜日', jmdict: '1194290' },
      { form: '水曜日', jmdict: '1372190' },
      { form: '木曜日', jmdict: '1534890' },
      { form: '金曜日', jmdict: '1243320' },
      { form: '土曜日', jmdict: '1445590' },
    ],
    question: { form: '何曜日', jmdict: '1189400' },
  },
]

// Kanji that look alike, with a one line hint how to tell them apart (KR9, KR35)
export const KANJI_LOOKALIKES: KanjiLookalikeGroup[] = [
  { kanji: ['人', '入', '八'], hint: 'In 人 the long stroke falls to the left and the short one leans on it. In 入 the long stroke falls to the right and covers the short one. In 八 the two strokes do not touch' },
  { kanji: ['大', '天'], hint: '天 is 大 with a bar on top' },
  { kanji: ['木', '本'], hint: '本 is 木 with a short bar across the foot of the trunk' },
  { kanji: ['日', '目', '白', '百'], hint: '日 has one bar inside, 目 has two. 白 is 日 with a tick on top, 百 is 白 with a bar above the tick' },
  { kanji: ['月', '目'], hint: 'Both have two bars inside. 目 is a closed box, 月 is open at the bottom and stands on two legs' },
  { kanji: ['土', '上'], hint: '土 is a cross on a base line. In 上 the short stroke sticks out to the right only and does not cross the upright' },
  { kanji: ['午', '年'], hint: 'Both start with a tick and a bar. 年 has three bars and a short upright on the left joining the lower two, 午 has two bars and nothing on the left' },
  { kanji: ['六', '立'], hint: 'Same top, a dot over a bar. Under it 六 has two legs spreading apart, 立 has two short strokes standing on a long ground line' },
  { kanji: ['千', '午'], hint: 'Both are 十 with something on top. 千 has one slanted stroke there, 午 has a slanted stroke and a bar' },
  { kanji: ['左', '右', '友'], hint: 'Same arm on the upper left. Under it 左 has a short upright between two bars, 右 a 口, 友 two strokes crossing. 左 starts with the bar, 右 with the sweep' },
  { kanji: ['小', '少'], hint: '少 is 小 with a long slanted stroke under it' },
  { kanji: ['多', '名'], hint: '名 ends in a 口. 多 has no 口, it is the same top shape twice' },
  { kanji: ['今', '会', '食'], hint: 'Same roof on all three. 今 has only two strokes under it, 会 has 二 and a folded shape, 食 is the big one with nine strokes in all' },
  { kanji: ['間', '聞'], hint: 'Same gate. 間 has 日 inside, 聞 has 耳' },
  { kanji: ['東', '車'], hint: '東 stands on the two spreading legs of 木, 車 has only a straight upright at the bottom' },
  { kanji: ['母', '毎'], hint: '毎 has two strokes on top that 母 does not have, and 母 has two dots inside' },
  { kanji: ['四', '西'], hint: '西 has a bar on top and its two inner strokes hang down from it. In 四 they stay inside the box' },
  { kanji: ['先', '生', '年'], hint: 'All three start with the same tick on the upper left. 生 stands on a flat bar, 先 on two legs, 年 on one long upright' },
  { kanji: ['語', '話', '読'], hint: 'All three have 言 on the left, look at the right half: 語 has 五 over 口, 話 has 千 over 口, 読 ends in two legs' },
  { kanji: ['週', '道'], hint: 'Same sweeping base under both. On it 週 carries a frame with a 口 inside, 道 carries 目 with strokes on top' },
]

// Keywords or word glosses too close to offer as options against each other (KR15, KR72)
export const CLOSE_MEANINGS: Array<[string, string]> = [
  // keywords
  ['heavens', 'sky'],
  ['tall', 'up'],
  ['small', 'few'],
  ['in front', 'previous'],
  ['outside', 'exit'],
  ['inside', 'enter'],
  ['say', 'talk'],
  ['talk', 'language'],
  ['time', 'interval'],
  ['part', 'half'],
  ['day', 'weekday'],
  ['week', 'weekday'],
  ['study', 'school'],
  ['say', 'language'],
  // glosses
  ['day, sun', 'one day'],
  ['day, sun', 'day of the week'],
  ['person', 'man'],
  ['yen', 'money'],
  ['father', 'father, dad'],
  ['mother', 'mother, mom'],
  ['child', 'boy'],
  ['child', 'girl'],
  ['few', 'a little'],
  ['small', 'a little'],
  ['white (the color)', 'white'],
  ['sky, heaven', 'sky'],
  ['above, top', 'high, tall, expensive'],
  ['in front, before', 'tip, ahead'],
  ['back, behind', 'after, later'],
  ['time, moment', 'time, hour'],
  ['half, half past', 'half'],
  ['to say', 'to talk, to speak'],
  ['talk, conversation', 'to talk, to speak'],
  ['to go', 'to leave, to go out'],
  ['to go', 'to go out (on an outing)'],
  ['to leave, to go out', 'to go out (on an outing)'],
  ['exit', 'to leave, to go out'],
  ['entrance', 'to enter'],
  ['rest, holiday', 'to rest, to take a day off'],
]
