/* 规则引擎与内容数据回归自测：node tools/selftest.js */
'use strict';
const B = require('../assets/js/bridge.js');
const D = require('../assets/js/data.js');

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const eq = (a, b, msg) => ok(a === b, `${msg} — 期望 ${b}，实际 ${a}`);

/* ---------- 牌与发牌 ---------- */
const deck = B.createDeck();
eq(deck.length, 52, '一副牌 52 张');
eq(new Set(deck.map(B.cardKey)).size, 52, '无重复牌');
eq(B.hcp(deck), 40, '全副牌共 40 大牌点');

for (let i = 0; i < 100; i++) {
  const d = B.deal();
  const all = [...d.N, ...d.E, ...d.S, ...d.W];
  ok(B.SEATS.every(s => d[s].length === 13), '每家 13 张');
  eq(new Set(all.map(B.cardKey)).size, 52, '发牌无重复');
  eq(B.SEATS.reduce((s, x) => s + B.hcp(d[x]), 0), 40, '四家点数合计 40');
}

/* ---------- 手牌解析与牌型 ---------- */
eq(B.rankValue('A'), 14, 'A 的点数值为 14');
eq(B.rankValue('2'), 2, '2 的点数值为 2');
ok(B.rankValue('A') > B.rankValue('K') && B.rankValue('K') > B.rankValue('Q'), '牌面大小 A > K > Q');
eq(B.parseHand('2A.-.-.-')[0].rank, 'A', '手牌内按点数降序排列');
eq(B.parseHand('AQJ9.K82.743.A65').length, 13, '示例手牌 1 共 13 张');
eq(B.hcp(B.parseHand('AQJ9.K82.743.A65')), 14, '示例手牌 1 = 14 点');
eq(B.shapeText(B.parseHand('AQJ9.K82.743.A65')), '4-3-3-3', '示例手牌 1 牌型');
ok(B.isBalanced(B.parseHand('AQJ9.K82.743.A65')), '4-3-3-3 是均型');
ok(B.isBalanced(B.parseHand('QJ976.K83.A2.K43')), '5-3-3-2 是均型');
ok(!B.isBalanced(B.parseHand('KQJ875.A93.6.K42')), '6-3-3-1 非均型');
eq(B.fiveCardMajor(B.parseHand('KQJ875.A93.6.K42')), 'S', '识别 5 张高花');
eq(B.parseHand('AKQJ.AKQJ.AKQJ2.-').length, 13, '缺门手牌 13 张');

/* ---------- 跟牌规则 ---------- */
const fh = B.parseHand('AKQJ.K83.7432.65');
eq(B.legalCards(fh, 'H').length, 3, '有红心时只能出 3 张红心');
ok(B.mustFollow(fh, 'H'), '有红心必须跟');
eq(B.legalCards(fh, 'C').length, 2, '有梅花时只能出 2 张梅花');
const voidHand = B.parseHand('AKQJ.AKQJ.AKQJ2.-');
ok(!B.mustFollow(voidHand, 'C'), '梅花缺门不必跟');
eq(B.legalCards(voidHand, 'C').length, 13, '缺门时全部 13 张都合法');

/* ---------- 赢墩判定 ---------- */
// 用紧凑串构造单张：花色位置 + rank
function single(suit, rank) {
  const parts = ['-', '-', '-', '-'];
  parts[B.SUITS.indexOf(suit)] = rank;
  return B.parseHand(parts.join('.'))[0];
}
function played(list) { return list.map((x, i) => ({ seat: ['N','E','S','W'][i], card: single(x[0], x[1]) })); }

let t1 = played([['H','3'], ['H','K'], ['S','A'], ['H','9']]);
eq(B.trickWinner(t1, 'NT').index, 1, '无将：首攻花色最大者赢（HK）');
let t2 = played([['H','3'], ['S','2'], ['H','A'], ['H','9']]);
eq(B.trickWinner(t2, 'S').index, 1, '有将：小将牌 ♠2 将吃压过 ♥A');
let t3 = played([['S','2'], ['S','A'], ['S','K'], ['H','A']]);
eq(B.trickWinner(t3, 'S').index, 1, '将牌领出：最大将牌赢');
let t4 = played([['D','A'], ['D','K'], ['C','2'], ['S','A']]);
eq(B.trickWinner(t4, 'H').index, 0, '无人将吃：首攻花色最大者赢');
let t5 = played([['H','3'], ['S','2'], ['S','A'], ['H','K']]);
eq(B.trickWinner(t5, 'S').index, 2, '将牌之间比大小，超将吃');

for (let i = 0; i < 500; i++) {
  const r = B.randomTrick();
  ok(r && r.played && r.played.length === 4, '随机墩结构完整');
  ok(r && r.winner && r.winner.index >= 0 && r.winner.index < 4, '随机墩有赢家');
  const keys = r.played.map(p => B.cardKey(p.card));
  eq(new Set(keys).size, 4, '随机墩四张牌不重复');
}
for (let i = 0; i < 200; i++) {
  const f = B.randomFollow();
  ok(f.hand.length === 13 && f.legal.length > 0, '随机跟牌题结构完整');
  ok(f.legal.every(c => f.hand.some(h => B.cardKey(h) === B.cardKey(c))), '合法牌来自手牌');
}

/* ---------- 计分 ---------- */
const sc = (level, strain, doubled, vulnerable, tricks) =>
  B.score({ level, strain, doubled, vulnerable, tricks }).total;
eq(sc(3, 'NT', 0, false, 9), 400, '3NT 无局正好完成 = 400');
eq(sc(3, 'NT', 0, true, 9), 600, '3NT 有局正好完成 = 600');
eq(sc(3, 'NT', 0, false, 10), 430, '3NT 无局超一 = 430');
eq(sc(4, 'S', 0, true, 10), 620, '4♠ 有局正好完成 = 620');
eq(sc(2, 'H', 0, false, 8), 110, '2♥ 无局部分定约 = 110');
eq(sc(5, 'C', 0, false, 11), 400, '5♣ 无局成局 = 400');
eq(sc(6, 'NT', 0, false, 12), 990, '6NT 无局小满贯 = 990');
eq(sc(2, 'H', 1, false, 8), 470, '2♥ 加倍后墩分 120 达成局 = 470');
eq(sc(3, 'NT', 0, true, 7), 200, '3NT 有局宕 2 = 防守方 200');
eq(sc(3, 'NT', 0, false, 5), 200, '未加倍无局宕 4 = 200');
eq(sc(3, 'NT', 1, false, 5), 800, '加倍无局宕 4 = 800');
eq(sc(3, 'NT', 1, true, 8), 200, '加倍有局宕 1 = 200');
eq(sc(3, 'NT', 2, false, 8), 200, '再加倍无局宕 1 = 200');
eq(B.score({ level: 3, strain: 'NT', doubled: 0, vulnerable: false, tricks: 7 }).winner, 'defenders', '未完成时胜方为防守方');
eq(B.score({ level: 3, strain: 'NT', doubled: 0, vulnerable: false, tricks: 9 }).winner, 'declarer', '完成时胜方为庄家方');
eq(B.contractBase(3, 'NT', 0), 100, '3NT 定约墩分 100');
eq(B.contractBase(4, 'C', 0), 80, '4♣ 定约墩分 80（未成局）');

/* ---------- 内容数据完整性 ---------- */
const hands = [];
D.lessons.forEach(L => L.sections.filter(s => s.type === 'hand').forEach(s => hands.push(['课程 ' + L.id, s.hand])));
D.bidQuestions.forEach((q, i) => hands.push(['叫牌题 ' + (i + 1), q.hand]));
D.quiz.filter(q => q.hand).forEach((q, i) => hands.push(['测验手牌 ' + (i + 1), q.hand]));
['AKQJ.AKQJ.AKQJ2.-', 'AKQJ2.-.AKQJ.AKQJ', '-.AKQJ2.AKQJ.AKQJ'].forEach((h, i) => hands.push(['缺门情境 ' + (i + 1), h]));
hands.forEach(([name, str]) => {
  const cards = B.parseHand(str);
  eq(cards.length, 13, name + ' 应为 13 张');
  eq(new Set(cards.map(B.cardKey)).size, 13, name + ' 无重复牌');
});

console.log('\n叫牌题库点数核对（应与每题解析中的数字一致）：');
D.bidQuestions.forEach((q, i) => {
  const d = B.describeHand(B.parseHand(q.hand));
  console.log(`  ${i + 1}. ${q.hand.padEnd(22)} ${String(d.hcp).padStart(2)} 点  ${d.shape}  ${d.balanced ? '均型' : '非均型'}  → ${q.answer}`);
  ok(D.BID_OPTIONS.some(o => o.v === q.answer), `叫牌题 ${i + 1} 的答案在选项中`);
});

D.lessons.forEach(L => {
  ok(L.check.options.length >= 2 && L.check.answer >= 0 && L.check.answer < L.check.options.length, `${L.id} 随堂小测答案合法`);
  ok(L.sections.length >= 5, `${L.id} 至少 5 个内容块`);
});
D.quiz.forEach((q, i) => {
  ok(q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length, `测验题 ${i + 1} 答案合法`);
  ok(!!q.explain, `测验题 ${i + 1} 有解析`);
});
D.glossary.forEach((g, i) => {
  ok(g.term && g.en && g.cat && g.brief && g.detail, `术语 ${i + 1} 字段完整`);
});
eq(D.lessons.length, 5, '共 5 节课程');
eq(D.quiz.length, 12, '共 12 道测验题');

/* ---------- 汇总 ---------- */
if (fails.length) {
  console.log('\n❌ 失败 ' + fails.length + ' 项：');
  fails.slice(0, 40).forEach(f => console.log('  - ' + f));
  process.exit(1);
} else {
  console.log('\n✅ 全部自测通过（发牌/牌型/跟牌/赢墩/计分/数据完整性）');
}
