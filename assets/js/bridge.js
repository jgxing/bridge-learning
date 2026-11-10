/* ============================================================
   bridge.js — 定约桥牌规则引擎（纯逻辑，不依赖 DOM）
   提供：牌模型 / 发牌 / 大牌点 / 牌型 / 跟牌 / 赢墩 / 复式计分
   ============================================================ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.Bridge = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SUITS = ['S', 'H', 'D', 'C'];
  var RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
  var SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣', NT: 'NT' };
  var SUIT_NAME = { S: '黑桃', H: '红心', D: '方块', C: '梅花', NT: '无将' };
  var HCP = { A: 4, K: 3, Q: 2, J: 1 };
  var STRAIN_ORDER = ['C', 'D', 'H', 'S', 'NT'];
  var SEATS = ['N', 'E', 'S', 'W'];

  function rankValue(rank) { return 14 - RANKS.indexOf(rank); } // A=14, K=13 ... 2=2
  function rankLabel(rank) { return rank === 'T' ? '10' : rank; }
  function isRedSuit(suit) { return suit === 'H' || suit === 'D'; }
  function suitSymbol(suit) { return SYMBOL[suit] || suit; }

  function card(suit, rank) { return { suit: suit, rank: rank }; }
  function cardKey(c) { return c.suit + c.rank; }
  function cardLabel(c) { return suitSymbol(c.suit) + rankLabel(c.rank); }

  function createDeck() {
    var deck = [];
    SUITS.forEach(function (s) { RANKS.forEach(function (r) { deck.push(card(s, r)); }); });
    return deck;
  }

  function shuffle(arr, rng) {
    var rnd = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /** 发一副牌，返回 {N:[13],E:[13],S:[13],W:[13]}，每手按花色分组降序排好 */
  function deal(rng) {
    var deck = shuffle(createDeck(), rng);
    var out = { N: [], E: [], S: [], W: [] };
    SEATS.forEach(function (seat, i) { out[seat] = sortHand(deck.slice(i * 13, i * 13 + 13)); });
    return out;
  }

  /** 紧凑牌串 "AKJ9.K82.743.A65" = ♠/♥/♦/♣；T 表示 10，"-" 或空表示缺门 */
  function parseHand(str) {
    var parts = String(str).trim().split('.');
    if (parts.length !== 4) throw new Error('手牌格式应为 S.H.D.C 四段：' + str);
    var cards = [];
    parts.forEach(function (chunk, i) {
      var suit = SUITS[i];
      var raw = chunk.replace(/\s/g, '');
      if (raw === '-' || raw === '') return;
      var tokens = raw.match(/T|[2-9AKQJ]/gi) || [];
      tokens.forEach(function (t) { cards.push(card(suit, t.toUpperCase())); });
    });
    return sortHand(cards);
  }

  function groupBySuit(cards) {
    var g = { S: [], H: [], D: [], C: [] };
    cards.forEach(function (c) { g[c.suit].push(c); });
    SUITS.forEach(function (s) { g[s].sort(function (a, b) { return rankValue(b.rank) - rankValue(a.rank); }); });
    return g;
  }

  function sortHand(cards) {
    var g = groupBySuit(cards), out = [];
    SUITS.forEach(function (s) { out = out.concat(g[s]); });
    return out;
  }

  function toCompact(cards) {
    var g = groupBySuit(cards);
    return SUITS.map(function (s) { return g[s].length ? g[s].map(function (c) { return c.rank; }).join('') : '-'; }).join('.');
  }

  /** 大牌点 A=4 K=3 Q=2 J=1，全副共 40 点 */
  function hcp(cards) {
    return cards.reduce(function (sum, c) { return sum + (HCP[c.rank] || 0); }, 0);
  }

  function honorDetail(cards) {
    var d = { A: 0, K: 0, Q: 0, J: 0 };
    cards.forEach(function (c) { if (HCP[c.rank]) d[c.rank]++; });
    return d;
  }

  /** 牌型：各花色张数，按长度从大到小排列，如 5-3-3-2 */
  function shape(cards) {
    var g = groupBySuit(cards);
    return SUITS.map(function (s) { return g[s].length; }).sort(function (a, b) { return b - a; });
  }
  function shapeText(cards) { return shape(cards).join('-'); }

  /** 均型：无单张、无缺门、最多一个双张（4-3-3-3 / 4-4-3-2 / 5-3-3-2） */
  function isBalanced(cards) {
    var s = shape(cards);
    return !s.includes(0) && !s.includes(1) && s.filter(function (n) { return n === 2; }).length <= 1;
  }

  function suitLengths(cards) {
    var g = groupBySuit(cards);
    return { S: g.S.length, H: g.H.length, D: g.D.length, C: g.C.length };
  }

  function longestSuit(cards) {
    var len = suitLengths(cards), best = 'S', bestLen = -1;
    SUITS.forEach(function (s) { if (len[s] > bestLen) { bestLen = len[s]; best = s; } });
    return { suit: best, length: bestLen };
  }

  function fiveCardMajor(cards) {
    var len = suitLengths(cards);
    if (len.H >= 5) return 'H';
    if (len.S >= 5) return 'S';
    return null;
  }

  function describeHand(cards) {
    return {
      hcp: hcp(cards),
      shape: shapeText(cards),
      balanced: isBalanced(cards),
      lengths: suitLengths(cards),
      longest: longestSuit(cards),
      fiveCardMajor: fiveCardMajor(cards),
      honors: honorDetail(cards)
    };
  }

  /** 跟牌规则：有领出花色就必须跟，没有则可任意垫牌或将吃 */
  function legalCards(hand, ledSuit) {
    var same = hand.filter(function (c) { return c.suit === ledSuit; });
    return same.length ? same : hand.slice();
  }
  function mustFollow(hand, ledSuit) {
    return hand.some(function (c) { return c.suit === ledSuit; });
  }

  /**
   * 判定一墩的赢家。
   * played: [{seat:'N', card:{...}}, ...]，按出牌先后排列，played[0] 为首攻
   * trump: 'S'|'H'|'D'|'C'|'NT'
   * 返回 {index, seat, card, reason}
   */
  function trickWinner(played, trump) {
    if (!played.length) return null;
    var led = played[0].card.suit;
    var trumps = trump && trump !== 'NT'
      ? played.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.card.suit === trump; })
      : [];
    var pool, reason;
    if (trumps.length) {
      pool = trumps;
      reason = '本墩有将牌 ' + suitSymbol(trump) + ' 出现，最大的将牌赢墩';
    } else {
      pool = played.map(function (p, i) { return { p: p, i: i }; }).filter(function (x) { return x.p.card.suit === led; });
      reason = trump && trump !== 'NT'
        ? '没有人将吃，首攻花色 ' + suitSymbol(led) + ' 中最大的牌赢墩'
        : '无将定约，只看首攻花色 ' + suitSymbol(led) + '，其中最大的牌赢墩';
    }
    var best = pool.reduce(function (a, b) {
      return rankValue(b.p.card.rank) > rankValue(a.p.card.rank) ? b : a;
    });
    return { index: best.i, seat: best.p.seat, card: best.p.card, reason: reason, ledSuit: led };
  }

  /** 叫品文字，如 3NT / 4♠× / 2♦×× */
  function contractLabel(level, strain, doubled) {
    var s = String(level) + (strain === 'NT' ? 'NT' : suitSymbol(strain));
    if (doubled === 1) s += ' ×';
    if (doubled === 2) s += ' ××';
    return s;
  }
  function strainLabel(strain) { return strain === 'NT' ? '无将' : SUIT_NAME[strain] + ' ' + suitSymbol(strain); }
  function neededTricks(level) { return 6 + level; }

  /** 每墩墩分：低花 20，高花 30，无将首墩 40、其余 30 */
  function basePerTrick(strain) { return (strain === 'C' || strain === 'D') ? 20 : 30; }
  function contractBase(level, strain, doubled) {
    var base = strain === 'NT' ? 30 * level + 10 : basePerTrick(strain) * level;
    return base * (doubled === 2 ? 4 : doubled === 1 ? 2 : 1);
  }

  function penalty(undertricks, doubled, vulnerable) {
    if (doubled === 0) return undertricks * (vulnerable ? 100 : 50);
    var p;
    if (vulnerable) p = 200 + (undertricks - 1) * 300;
    else p = undertricks <= 1 ? 100
      : undertricks <= 3 ? 100 + (undertricks - 1) * 200
      : 500 + (undertricks - 3) * 300;
    return p * (doubled === 2 ? 2 : 1);
  }

  /**
   * 复式桥牌计分（不含叫牌盒/队式转换，仅一副牌的分数）
   * opts: {level:1-7, strain:'C'|'D'|'H'|'S'|'NT', doubled:0|1|2, vulnerable:bool, tricks:0-13}
   */
  function score(opts) {
    var level = Math.max(1, Math.min(7, Number(opts.level) || 1));
    var strain = STRAIN_ORDER.indexOf(opts.strain) >= 0 ? opts.strain : 'NT';
    var doubled = [0, 1, 2].indexOf(Number(opts.doubled)) >= 0 ? Number(opts.doubled) : 0;
    var vul = !!opts.vulnerable;
    var tricks = Math.max(0, Math.min(13, Number(opts.tricks)));
    var need = neededTricks(level);
    var base = contractBase(level, strain, doubled);
    var game = base >= 100;
    var rows = [];
    var total = 0;

    if (tricks < need) {
      var under = need - tricks;
      var def = penalty(under, doubled, vul);
      rows.push({ label: '宕 ' + under + ' 墩（' + (vul ? '有局' : '无局') + (doubled === 2 ? '、再加倍' : doubled === 1 ? '、加倍' : '') + '）', value: def });
      return {
        made: false, level: level, strain: strain, doubled: doubled, vulnerable: vul,
        needed: need, tricks: tricks, undertricks: under, overtricks: 0,
        contractBase: base, game: game, breakdown: rows,
        declarerPoints: 0, defenderPoints: def, total: def, winner: 'defenders',
        label: contractLabel(level, strain, doubled)
      };
    }

    var over = tricks - need;
    rows.push({ label: '定约墩分 ' + contractLabel(level, strain, doubled) + '（' + base + '）', value: base });
    total += base;
    if (over > 0) {
      var per = basePerTrick(strain);
      var overPts;
      if (doubled === 0) overPts = over * (strain === 'NT' ? 30 : per);
      else if (doubled === 1) overPts = over * (vul ? 200 : 100);
      else overPts = over * (vul ? 400 : 200);
      rows.push({ label: '超墩 ' + over + ' 墩 × ' + (overPts / over) + ' 分', value: overPts });
      total += overPts;
    }
    var bonus = game ? (vul ? 500 : 300) : 50;
    rows.push({ label: game ? '成局奖（' + (vul ? '有局' : '无局') + '）' : '部分定约奖', value: bonus });
    total += bonus;
    if (level === 6 || level === 7) {
      var slam = level === 6 ? (vul ? 750 : 500) : (vul ? 1500 : 1000);
      rows.push({ label: (level === 6 ? '小满贯' : '大满贯') + '奖', value: slam });
      total += slam;
    }
    if (doubled) {
      var insult = doubled === 2 ? 100 : 50;
      rows.push({ label: (doubled === 2 ? '再加倍' : '加倍') + '完成奖', value: insult });
      total += insult;
    }
    return {
      made: true, level: level, strain: strain, doubled: doubled, vulnerable: vul,
      needed: need, tricks: tricks, undertricks: 0, overtricks: over,
      contractBase: base, game: game, breakdown: rows,
      declarerPoints: total, defenderPoints: 0, total: total, winner: 'declarer',
      label: contractLabel(level, strain, doubled)
    };
  }

  /** 生成一墩练习：保证至少有跟牌竞争或将牌出现，避免过于trivial */
  function randomTrick(rng) {
    var rnd = rng || Math.random;
    var trumpPool = ['NT', 'S', 'H', 'D', 'C'];
    for (var attempt = 0; attempt < 200; attempt++) {
      var deck = shuffle(createDeck(), rnd).slice(0, 4);
      var trump = trumpPool[Math.floor(rnd() * trumpPool.length)];
      var leadSeat = Math.floor(rnd() * 4);
      var seats = [];
      for (var i = 0; i < 4; i++) seats.push(SEATS[(leadSeat + i) % 4]);
      var played = deck.map(function (c, i) { return { seat: seats[i], card: c }; });
      var led = played[0].card.suit;
      var followed = played.slice(1).filter(function (p) { return p.card.suit === led; }).length;
      var trumped = trump !== 'NT' && played.some(function (p) { return p.card.suit === trump && p.card.suit !== led; });
      // 至少两张同花色（比较大小）或发生将吃，才有练习价值
      if (followed >= 1 || trumped) {
        return { played: played, trump: trump, winner: trickWinner(played, trump) };
      }
    }
    // 极小概率未抽到合适组合时给一道保底题
    var fallback = shuffle(createDeck(), rnd).slice(0, 4).map(function (c, i) {
      return { seat: SEATS[i], card: c };
    });
    return { played: fallback, trump: 'NT', winner: trickWinner(fallback, 'NT') };
  }

  /** 生成跟牌题：优先给出必须跟同花色的情境 */
  function randomFollow(rng) {
    var rnd = rng || Math.random;
    var full = deal(rnd);
    var hand = full.S;
    var counts = suitLengths(hand);
    var candidates = SUITS.filter(function (s) { return counts[s] >= 2; });
    var led = candidates.length ? candidates[Math.floor(rnd() * candidates.length)] : SUITS[Math.floor(rnd() * 4)];
    return { hand: hand, ledSuit: led, trump: 'NT', mustFollow: mustFollow(hand, led), legal: legalCards(hand, led) };
  }

  return {
    SUITS: SUITS, RANKS: RANKS, SEATS: SEATS, SYMBOL: SYMBOL, SUIT_NAME: SUIT_NAME,
    HCP: HCP, STRAIN_ORDER: STRAIN_ORDER,
    rankValue: rankValue, rankLabel: rankLabel, isRedSuit: isRedSuit, suitSymbol: suitSymbol,
    card: card, cardKey: cardKey, cardLabel: cardLabel,
    createDeck: createDeck, shuffle: shuffle, deal: deal,
    parseHand: parseHand, groupBySuit: groupBySuit, sortHand: sortHand, toCompact: toCompact,
    hcp: hcp, honorDetail: honorDetail, shape: shape, shapeText: shapeText,
    isBalanced: isBalanced, suitLengths: suitLengths, longestSuit: longestSuit,
    fiveCardMajor: fiveCardMajor, describeHand: describeHand,
    legalCards: legalCards, mustFollow: mustFollow, trickWinner: trickWinner,
    contractLabel: contractLabel, strainLabel: strainLabel, neededTricks: neededTricks,
    basePerTrick: basePerTrick, contractBase: contractBase, penalty: penalty, score: score,
    randomTrick: randomTrick, randomFollow: randomFollow
  };
});
