// Attribution translations for the existing English-language source passages.
// Text, IDs, availability dates and evidence links all remain from the corpus.
const authors = Object.freeze({
  '爱比克泰德': 'Epictetus',
  '约翰·沃尔夫冈·冯·歌德': 'Johann Wolfgang von Goethe',
  '弗朗西斯·培根': 'Francis Bacon',
  '拉尔夫·沃尔多·爱默生': 'Ralph Waldo Emerson',
  '亨利·戴维·梭罗': 'Henry David Thoreau',
  '马可·奥勒留': 'Marcus Aurelius',
  '布莱兹·帕斯卡': 'Blaise Pascal',
  '拉宾德拉纳特·泰戈尔': 'Rabindranath Tagore',
  '威廉·莎士比亚': 'William Shakespeare',
  '米歇尔·德·蒙田': 'Michel de Montaigne',
  '玛丽·沃斯通克拉夫特': 'Mary Wollstonecraft',
  '巴鲁赫·斯宾诺莎': 'Baruch Spinoza',
  '塞涅卡': 'Seneca',
  '艾米莉·狄金森': 'Emily Dickinson',
  '沃尔特·惠特曼': 'Walt Whitman',
});

const titles = Object.freeze({
  '手册': 'Enchiridion',
  '格言与省思': 'Maxims and Reflections',
  '培根随笔': 'Essays',
  '论复仇': 'Of Revenge',
  '论逆境': 'Of Adversity',
  '论游历': 'Of Travel',
  '论花园': 'Of Gardens',
  '论读书': 'Of Studies',
  '论礼仪与礼貌': 'Of Ceremonies and Respects',
  '论司法': 'Of Judicature',
  '爱默生随笔': 'Essays',
  '美国学者': 'The American Scholar',
  '论自立': 'Self-Reliance',
  '论礼物': 'Gifts',
  '论自然': 'Nature',
  '论圆': 'Circles',
  '瓦尔登湖': 'Walden',
  '经济篇': 'Economy',
  '我生活的地方；我为何生活': 'Where I Lived, and What I Lived For',
  '来客': 'Visitors',
  '更高的法则': 'Higher Laws',
  '冬天的湖': 'The Pond in Winter',
  '结束语': 'Conclusion',
  '沉思录': 'Meditations',
  '思想录': 'Pensées',
  '飞鸟集': 'Stray Birds',
  '十四行诗': 'Sonnets',
  '蒙田随笔全集': 'The Complete Essays',
  '论隐居': 'Of Solitude',
  '论儿童教育': 'Of the Education of Children',
  '论练习': 'Of Practice',
  '论悔恨': 'Of Repentance',
  '论经验': 'Of Experience',
  '女权辩护': 'A Vindication of the Rights of Woman',
  '致塔列朗先生的献辞': 'Dedication to M. Talleyrand-Périgord',
  '伦理学': 'Ethics',
  '短篇对话集': 'Minor Dialogues',
  '论生命之短暂': 'On the Shortness of Life',
  '论愤怒': 'On Anger',
  '论幸福生活': 'On the Happy Life',
  '论心灵的安宁': 'On Tranquillity of Mind',
  '狄金森诗集（三辑）': 'Poems by Emily Dickinson, Three Series',
  '成功': 'Success',
  '排拒': 'Exclusion',
  '希望': 'Hope',
  '一个词': 'A Word',
  '志向': 'Aspiration',
  '书': 'A Book',
  '大脑': 'The Brain',
  '黎明': 'Dawn',
  '悲伤': 'Grief',
  '草叶集': 'Leaves of Grass',
  '自我之歌': 'Song of Myself',
  '大路之歌': 'Song of the Open Road',
  '哦，我！哦，生命！': 'O Me! O Life!',
  '更有力的教训': 'Stronger Lessons',
});

function englishSource(source, author) {
  const ordinal = { '一': 'First', '二': 'Second', '三': 'Third' };
  const roman = { '一': 'I', '二': 'II', '三': 'III', '四': 'IV', '五': 'V' };
  return source
    .replace(/《([^》]+)》/g, (_, title) => {
      const translated = title === '论友谊'
        ? (author === '弗朗西斯·培根' ? 'Of Friendship' : 'Friendship')
        : titles[title];
      if (!translated) throw new TypeError(`Missing English source title: ${title}`);
      return `“${translated}”`;
    })
    .replace(/”“/g, '”, “')
    .replace(/格言 (\d+)/g, ', maxim $1')
    .replace(/第 (\d+) 卷/g, ', book $1')
    .replace(/第([一二三])卷/g, (_, value) => `, book ${roman[value]}, `)
    .replace(/第([四五])部分，命题 (\d+)/g, (_, value, number) => `, part ${roman[value]}, proposition ${number}`)
    .replace(/ 附释末句/g, ', final sentence of the scholium')
    .replace(/第 (\d+) 节/g, ', section $1')
    .replace(/第 (\d+) 则/g, ', no. $1')
    .replace(/第 (\d+) 首/g, ', poem $1')
    .replace(/第 (\d+(?:—\d+)?) 行/g, 'lines $1')
    .replace(/（本版第 (\d+) 章）/g, ' (chapter $1 in this edition)')
    .replace(/（第 (\d+) 章）/g, ' (chapter $1)')
    .replace(/第 (\d+) 章/g, ', chapter $1')
    .replace(/第([一二三])辑·/g, (_, value) => `, ${ordinal[value]} Series, `)
    .replace(/时间与永恒/g, 'Time and Eternity')
    .replace(/生命/g, 'Life')
    .replace(/自然/g, 'Nature')
    .replace(/末节/g, ', final section')
    .replace(/，/g, ', ')
    .replace(/—/g, '–')
    .replace(/,\s*,\s*/g, ', ');
}

export function englishQuoteAttribution(quote) {
  const author = authors[quote.author];
  if (!author) throw new TypeError(`Missing English quote author: ${quote.author}`);
  const source = englishSource(quote.source, quote.author);
  if (/\p{Script=Han}/u.test(source)) throw new TypeError(`Incomplete English source: ${source}`);
  return { author, source };
}

/** Keep daily selection deterministic within the source's English passage pool. */
export function englishQuotePool(quotes) {
  return quotes.filter(quote => quote.originalLanguage === 'en' && typeof quote.original === 'string' && quote.original.trim())
    .map(quote => ({ ...quote, text: quote.original, ...englishQuoteAttribution(quote) }));
}
