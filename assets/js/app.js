/* ============================================================
   app.js — 界面渲染与全部交互
   ============================================================ */
(function () {
  'use strict';

  var B = window.Bridge;
  var D = window.BRIDGE_DATA;
  var STORE_KEY = 'bridge-basics-v1';

  function $(sel, base) { return (base || document).querySelector(sel); }
  function $$(sel, base) { return Array.prototype.slice.call((base || document).querySelectorAll(sel)); }
  function esc(s) {
    var a = String.fromCharCode(38);
    var map = { '&': a + 'amp;', '<': a + 'lt;', '>': a + 'gt;', '"': a + 'quot;', "'": a + '#39;' };
    return String(s).replace(/[&<>"']/g, function (c) { return map[c]; });
  }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  /* ---------------- 本地学习记录 ---------------- */
  var defaults = { done: [], quizBest: null, hcpR: 0, hcpW: 0, bidR: 0, bidW: 0, followR: 0, followW: 0, trickR: 0, trickW: 0 };
  var S = load();
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaults));
      var obj = JSON.parse(raw), out = JSON.parse(JSON.stringify(defaults));
      Object.keys(out).forEach(function (k) { if (obj[k] !== undefined) out[k] = obj[k]; });
      if (!Array.isArray(out.done)) out.done = [];
      return out;
    } catch (e) { return JSON.parse(JSON.stringify(defaults)); }
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { /* 隐私模式下忽略 */ } }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('is-on');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('is-on'); }, 2300);
  }
  function refreshProgress() {
    var n = S.done.length, total = D.lessons.length;
    $('#progressChip').textContent = '课程 ' + n + '/' + total;
    $('#footerProgress').textContent = '学习进度：' + n + '/' + total + ' 节';
  }
  function markDone(id) {
    if (S.done.indexOf(id) < 0) { S.done.push(id); save(); refreshProgress(); renderPath(); renderToc(); toast('本节已完成 ✓'); }
  }

  /* ---------------- 牌面渲染 ---------------- */
  function cardHtml(c, extra, large) {
    var red = B.isRedSuit(c.suit);
    var cls = 'card ' + (red ? 'red' : 'black') + (large ? ' card-lg' : '') + (extra ? ' ' + extra : '');
    var sym = B.suitSymbol(c.suit);
    return '<span class="' + cls + '" data-card="' + B.cardKey(c) + '">' +
      '<span class="c-rank">' + B.rankLabel(c.rank) + '</span>' +
      '<span class="c-suit-sm">' + sym + '</span>' +
      '<span class="c-pip">' + sym + '</span></span>';
  }
  function renderHand(cards, opts) {
    opts = opts || {};
    var g = B.groupBySuit(cards), out = '<div class="hand">';
    B.SUITS.forEach(function (s) {
      out += '<div class="hand-row"><span class="suit-badge suit-' + s + '">' + B.SYMBOL[s] + '</span>';
      if (!g[s].length) out += '<span class="card-void">— 缺门</span>';
      else g[s].forEach(function (c) {
        var extra = opts.pickable ? 'card-btn' : '';
        if (opts.pickable) extra += ' hand-card';
        if (opts.selected && opts.selected[B.cardKey(c)]) extra += ' is-selected';
        if (opts.hintLegal && opts.legalKeys && opts.legalKeys.indexOf(B.cardKey(c)) < 0) extra += ' is-dim';
        out += cardHtml(c, extra, opts.large);
      });
      out += '</div>';
    });
    return out + '</div>';
  }
  function handFigure(str, caption) {
    var cards = B.parseHand(str), d = B.describeHand(cards);
    return '<figure class="hand-figure">' + renderHand(cards) +
      (caption ? '<figcaption>' + caption + '</figcaption>' : '') +
      '<div class="hand-summary"><span class="tag">' + d.hcp + ' 大牌点</span>' +
      '<span class="tag tag-gold">牌型 ' + d.shape + (d.balanced ? ' · 均型' : ' · 非均型') + '</span>' +
      '<span class="tag">最长套 ' + B.suitSymbol(d.longest.suit) + ' ' + d.longest.length + ' 张</span></div></figure>';
  }
  function honorBreakdown(cards) {
    var g = B.groupBySuit(cards), total = 0, html = '<div class="hcp-detail">';
    B.SUITS.forEach(function (s) {
      var honors = g[s].filter(function (c) { return B.HCP[c.rank]; });
      var pts = honors.reduce(function (a, c) { return a + B.HCP[c.rank]; }, 0);
      total += pts;
      html += '<div><span class="suit-' + s + '">' + B.SYMBOL[s] + '</span> ' +
        (honors.length ? honors.map(function (c) { return '<span class="hcp-honor">' + B.rankLabel(c.rank) + '</span>(' + B.HCP[c.rank] + ')'; }).join(' + ') + ' = ' + pts + ' 点' : '无大牌 = 0 点') + '</div>';
    });
    return { html: html + '<div style="margin-top:6px"><strong>合计 ' + total + ' 点</strong></div></div>', total: total };
  }

  /* ---------------- 首页 ---------------- */
  var PRACTICE_TARGET = { l1: 'hcp', l2: 'hcp', l3: 'bid', l4: 'follow', l5: 'scoring' };
  function renderPath() {
    $('#pathGrid').innerHTML = D.lessons.map(function (L, i) {
      return '<a class="path-card" href="#/lessons/' + L.id + '">' +
        (S.done.indexOf(L.id) >= 0 ? '<span class="path-done">✓ 已完成</span>' : '') +
        '<span class="path-num">' + L.num + '</span><h3>' + L.title + '</h3>' +
        '<p>' + L.subtitle + '</p><span class="path-go">进入第 ' + (i + 1) + ' 节 →</span></a>';
    }).join('') + '<a class="path-card" href="#/quiz"><span class="path-num">✓</span><h3>综合测验</h3>' +
      '<p>12 道题检验所学，逐题解析，成绩保存在本机。</p><span class="path-go">去测验 →</span></a>';
    // 卡片内嵌第二个链接需避免嵌套 a，改由脚注提示
  }
  function initHome() {
    renderPath();
    var btn = $('#dealBtn');
    btn.addEventListener('click', function () {
      var d = B.deal(), ns = B.hcp(d.N) + B.hcp(d.S), ew = 40 - ns;
      ['N', 'E', 'S', 'W'].forEach(function (seat) {
        var h = d[seat];
        var node = $('.seat-' + seat.toLowerCase(), $('#feltTable'));
        $('.seat-info', node).textContent = B.hcp(h) + ' 点 · ' + B.shapeText(h);
        node.classList.add('deal-pop');
      });
      var verdict = ns >= 33 ? '可探索满贯' : ns >= 25 ? '够叫成局' : ns >= 20 ? '可邀请成局' : ns >= 16 ? '宜打部分定约' : '东西牌力占优';
      $('#tableContract').textContent = '南北 ' + ns + ' 点 · 东西 ' + ew + ' 点';
      $('#dealNote').textContent = verdict + '（联手 25 点以上通常够成局）';
      $('.seat-s', $('#feltTable')).classList.add('is-you');
      setTimeout(function () { $$('.seat', $('#feltTable')).forEach(function (n) { n.classList.remove('deal-pop'); }); }, 450);
    });
  }

  /* ---------------- 课程 ---------------- */
  function renderSection(sec) {
    var h = sec.heading ? '<h2>' + sec.heading + '</h2>' : '';
    switch (sec.type) {
      case 'prose': return '<div class="lesson-section">' + h + '<p>' + sec.html + '</p></div>';
      case 'callout': return '<div class="lesson-section"><div class="callout callout-' + sec.tone + '"><strong>' + sec.title + '</strong><p>' + sec.html + '</p></div></div>';
      case 'steps': return '<div class="lesson-section">' + h + '<div class="steps-grid">' + sec.items.map(function (it) {
        return '<div class="step-card"><b>' + it.label + '</b><span>' + it.text + '</span></div>';
      }).join('') + '</div></div>';
      case 'table': return '<div class="lesson-section">' + h + '<table class="data-table"><thead><tr>' +
        sec.head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
        sec.rows.map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + x + '</td>'; }).join('') + '</tr>'; }).join('') +
        '</tbody></table></div>';
      case 'hand': return '<div class="lesson-section">' + h + handFigure(sec.hand, sec.caption) + '</div>';
      default: return '';
    }
  }
  function renderToc(current) {
    $('#lessonToc').innerHTML = '<div class="toc-title">目录 · CONTENTS</div>' + D.lessons.map(function (L) {
      return '<a class="toc-item' + (L.id === current ? ' is-active' : '') + '" href="#/lessons/' + L.id + '">' +
        '<span class="toc-idx">' + L.num + '</span><span>' + L.title + '</span>' +
        (S.done.indexOf(L.id) >= 0 ? '<span class="toc-check">✓</span>' : '') + '</a>';
    }).join('');
  }
  function renderLesson(id) {
    var L = D.lessons.filter(function (x) { return x.id === id; })[0] || D.lessons[0];
    renderToc(L.id);
    var idx = D.lessons.indexOf(L);
    var prev = D.lessons[idx - 1], next = D.lessons[idx + 1];
    var target = PRACTICE_TARGET[L.id];
    var practiceHref = target === 'scoring' ? '#/scoring' : '#/practice/' + target;
    $('#lessonBody').innerHTML =
      '<div class="lesson-kicker">第 ' + L.num + ' 节 · ' + L.tag + '</div>' +
      '<h1>' + L.title + '</h1><p class="lesson-sub">' + L.subtitle + '</p>' +
      '<div class="lesson-meta"><span>⏱ 约 ' + L.minutes + ' 分钟</span><span>✦ 含随堂小测</span><span>↗ <a class="text-link" href="' + practiceHref + '">配套练习</a></span></div>' +
      L.sections.map(renderSection).join('') +
      '<div class="lesson-section"><h2>随堂小测</h2><div class="exercise-card" style="padding:22px">' +
      '<p class="ex-prompt">' + L.check.question + '</p>' +
      '<div class="options" id="lessonOptions">' + L.check.options.map(function (o, i) {
        return '<button class="option" data-idx="' + i + '"><span class="opt-key">' + 'ABCDEFGH'[i] + '</span>' + o + '</button>';
      }).join('') + '</div><div id="lessonFeedback"></div></div></div>' +
      '<div class="lesson-nav">' +
      (prev ? '<a class="btn btn-outline btn-sm" href="#/lessons/' + prev.id + '">← 上一节 · ' + prev.title + '</a>' : '<span></span>') +
      (next ? '<a class="btn btn-primary btn-sm" href="#/lessons/' + next.id + '">下一节 · ' + next.title + ' →</a>'
        : '<a class="btn btn-gold btn-sm" href="#/quiz">全部学完 · 去测验 →</a>') + '</div>';

    $$('#lessonOptions .option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = Number(btn.dataset.idx), ok = i === L.check.answer;
        $$('#lessonOptions .option').forEach(function (b) { b.disabled = true; });
        if (ok) { btn.classList.add('is-correct'); markDone(L.id); }
        else { btn.classList.add('is-wrong'); $$('#lessonOptions .option')[L.check.answer].classList.add('is-correct'); }
        $('#lessonFeedback').innerHTML = '<div class="feedback ' + (ok ? 'ok' : 'no') + '"><strong>' +
          (ok ? '答对了！' : '再想想～') + '</strong><p>' + L.check.explain + '</p></div>' +
          (ok ? '' : '<div class="ex-actions"><button class="btn btn-outline btn-sm" id="retryLesson">重新作答</button></div>');
        if (!ok) $('#retryLesson').addEventListener('click', function () { renderLesson(L.id); });
      });
    });
  }

  /* ---------------- 练习通用小工具 ---------------- */
  function stats(r, w) {
    return '<div class="stat-strip"><div><strong>' + r + '</strong>答对</div><div><strong>' + w + '</strong>答错</div>' +
      '<div><strong>' + (r + w ? Math.round(r / (r + w) * 100) : 0) + '%</strong>正确率</div></div>';
  }
  function optionsHtml(list, extraStyle) {
    return '<div class="options"' + (extraStyle ? ' style="' + extraStyle + '"' : '') + '>' + list.map(function (o, i) {
      return '<button class="option' + (o.cls || '') + '" data-idx="' + i + '"><span class="opt-key">' + 'ABCDEFGH'[i] + '</span>' + o.label + '</button>';
    }).join('') + '</div>';
  }
  function feedback(ok, title, text) {
    return '<div class="feedback ' + (ok ? 'ok' : 'no') + '"><strong>' + title + '</strong><p>' + text + '</p></div>';
  }

  /* ---------------- 练习 ① 数大牌点 ---------------- */
  var P = {
    hcp: { hand: null, marked: {}, locked: false },
    bid: { queue: [], idx: 0, cur: null, locked: false, reveal: false },
    follow: { data: null, locked: false, hint: false },
    trick: { data: null, locked: false }
  };

  function newHcpHand() {
    var h;
    do { h = B.deal().S; } while (B.hcp(h) < 5 || B.hcp(h) > 21);
    P.hcp.hand = h; P.hcp.marked = {}; P.hcp.locked = false;
    renderHcp();
  }
  function markedPoints() {
    return Object.keys(P.hcp.marked).reduce(function (sum, k) {
      var r = k.slice(1); return sum + (B.HCP[r] || 0);
    }, 0);
  }
  function renderHcp() {
    var host = $('#panelHcp');
    host.innerHTML = '<div class="exercise-grid"><div class="exercise-main">' +
      '<div class="ex-title"><h2>这手牌几点的？</h2><span class="ex-counter">A=4 · K=3 · Q=2 · J=1</span></div>' +
      '<p class="ex-desc">数出这 13 张牌的大牌点（HCP）。可以先点击牌面里的大牌做标记，右侧会实时累计。</p>' +
      '<div id="hcpHand">' + renderHand(P.hcp.hand, { pickable: true, selected: P.hcp.marked }) + '</div>' +
      '<div class="hcp-input-row"><label for="hcpInput">我认为一共</label>' +
      '<input id="hcpInput" type="number" min="0" max="40" placeholder="?" inputmode="numeric"><span>点</span>' +
      '<button class="btn btn-primary btn-sm" id="hcpSubmit">提交答案</button></div>' +
      '<div id="hcpFeedback"></div>' +
      '<div class="ex-actions"><button class="btn btn-outline btn-sm" id="hcpSkip">换一手牌 →</button></div>' +
      '</div><div class="exercise-side">' + stats(S.hcpR, S.hcpW) +
      '<h3 style="font-size:1rem;margin-bottom:8px">计数板</h3>' +
      '<p class="muted" style="margin-bottom:10px">已标记大牌：<strong id="hcpMarked">0 点</strong>（点击牌面可取消标记）</p>' +
      '<div id="hcpDetail"><p class="muted">提交后会在这里逐门花色列出点数明细。</p></div>' +
      '<div class="callout callout-tip" style="margin-top:18px"><strong>小提示</strong><p>整副牌 40 点，一家平均 10 点。10 和 9 都不计点，只数 A / K / Q / J。</p></div>' +
      '<div class="point-legend"><span><b>A</b>4 点</span><span><b>K</b>3 点</span>' +
      '<span><b>Q</b>2 点</span><span><b>J</b>1 点</span></div>' +
      '</div></div>';

    $('#hcpHand').addEventListener('click', function (e) {
      var node = e.target.closest('[data-card]');
      if (!node || P.hcp.locked) return;
      var key = node.dataset.card;
      if (P.hcp.marked[key]) delete P.hcp.marked[key]; else P.hcp.marked[key] = true;
      node.classList.toggle('is-selected');
      $('#hcpMarked').textContent = markedPoints() + ' 点';
    });
    $('#hcpInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#hcpSubmit').click(); });
    $('#hcpSubmit').addEventListener('click', function () {
      if (P.hcp.locked) { newHcpHand(); return; }
      var val = $('#hcpInput').value.trim();
      if (val === '') { toast('先填一个点数再提交'); return; }
      var guess = Number(val), real = B.hcp(P.hcp.hand), ok = guess === real;
      P.hcp.locked = true;
      if (ok) S.hcpR++; else S.hcpW++; save();
      $('#hcpSubmit').textContent = '换一手牌 →';
      $('#hcpFeedback').innerHTML = feedback(ok, ok ? '答对了，' + real + ' 点！' : '差一点，正确答案是 ' + real + ' 点',
        ok ? '这手牌的牌型是 ' + B.shapeText(P.hcp.hand) + (B.isBalanced(P.hcp.hand) ? '（均型）' : '（非均型）') + '，' +
          (real >= 15 ? '属于强牌，可以考虑 1NT 或更强。' : real >= 12 ? '达到开叫门槛，可以开叫了。' : '不足 12 点，通常先 Pass。')
          : '别急，对照右侧明细再数一遍：只把 A、K、Q、J 加起来，10 及以下都不算。');
      $('#hcpDetail').innerHTML = honorBreakdown(P.hcp.hand).html;
      $$('#hcpHand .hand-card').forEach(function (n) { n.classList.remove('is-selected'); });
    });
    $('#hcpSkip').addEventListener('click', newHcpHand);
  }

  /* ---------------- 练习 ② 开叫决策 ---------------- */
  function nextBid() {
    if (!P.bid.queue.length || P.bid.idx >= P.bid.queue.length) {
      P.bid.queue = B.shuffle(D.bidQuestions.map(function (_, i) { return i; }));
      P.bid.idx = 0;
    }
    P.bid.cur = D.bidQuestions[P.bid.queue[P.bid.idx]];
    P.bid.locked = false; P.bid.reveal = false;
    renderBid();
  }
  function renderBid() {
    var q = P.bid.cur, cards = B.parseHand(q.hand), d = B.describeHand(cards);
    $('#panelBid').innerHTML = '<div class="exercise-grid"><div class="exercise-main">' +
      '<div class="ex-title"><h2>轮到你开叫</h2><span class="ex-counter">第 ' + (P.bid.idx + 1) + ' / ' + D.bidQuestions.length + ' 题</span></div>' +
      '<p class="ex-desc">你坐南家、第一家说话。按本站的「开叫速查表」，这手牌应该叫什么？</p>' +
      '<div class="hand-figure" style="margin:0 0 14px">' + renderHand(cards) +
      '<div class="hand-summary" id="bidReveal" hidden><span class="tag">' + d.hcp + ' 大牌点</span>' +
      '<span class="tag tag-gold">牌型 ' + d.shape + (d.balanced ? ' · 均型' : ' · 非均型') + '</span>' +
      (d.fiveCardMajor ? '<span class="tag">5 张高花 ' + B.suitSymbol(d.fiveCardMajor) + '</span>' : '') + '</div></figure>' +
      '<p class="muted" style="margin-bottom:6px">' + q.hint + ' <button class="link-btn" id="bidShow">显示点数与牌型</button></p>' +
      optionsHtml(D.BID_OPTIONS.map(function (o) { return { label: o.label, cls: ' bid-option' }; }), 'grid-template-columns:repeat(auto-fit,minmax(146px,1fr))') +
      '<div id="bidFeedback"></div>' +
      '<div class="ex-actions"><button class="btn btn-outline btn-sm" id="bidNext" hidden>下一题 →</button>' +
      '<a class="btn btn-sm btn-outline" href="#/lessons/l3">复习开叫速查表</a></div>' +
      '</div><div class="exercise-side">' + stats(S.bidR, S.bidW) +
      '<h3 style="font-size:1rem;margin-bottom:8px">判断顺序</h3>' +
      '<ol style="font-size:.87rem;color:var(--ink-soft);padding-left:20px;line-height:1.9;margin:0">' +
      '<li>先数大牌点：够不够 12 点？</li><li>有没有 5 张以上高花？→ 1♥ / 1♠</li>' +
      '<li>是不是均型？15~17 → 1NT，20~21 → 2NT</li><li>22 点以上 → 2♣ 强开叫</li>' +
      '<li>其余 12~14 点 → 开较长低花</li></ol>' +
      '<div class="callout callout-warn" style="margin-top:18px"><strong>别急着背表</strong><p>真实体系还有阻击叫、第三家轻开叫等例外，这里只练最核心的判断链。</p></div>' +
      '</div></div>';

    $('#bidShow').addEventListener('click', function () { $('#bidReveal').hidden = false; this.hidden = true; });
    $$('#panelBid .option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (P.bid.locked) return;
        var chosen = D.BID_OPTIONS[Number(btn.dataset.idx)].v, ok = chosen === q.answer;
        P.bid.locked = true;
        if (ok) S.bidR++; else S.bidW++; save();
        var answerLabel = D.BID_OPTIONS.filter(function (o) { return o.v === q.answer; })[0].label;
        $$('#panelBid .option').forEach(function (b) {
          b.disabled = true;
          if (D.BID_OPTIONS[Number(b.dataset.idx)].v === q.answer) b.classList.add('is-correct');
          else b.classList.add('is-muted');
        });
        if (!ok) btn.classList.remove('is-muted'), btn.classList.add('is-wrong');
        $('#bidFeedback').innerHTML = feedback(ok, ok ? '正确：' + answerLabel : '正确答案是 ' + answerLabel, q.explain);
        $('#bidReveal').hidden = false;
        $('#bidNext').hidden = false;
      });
    });
    $('#bidNext').addEventListener('click', function () { P.bid.idx++; nextBid(); });
  }

  /* ---------------- 练习 ③ 跟牌规则 ---------------- */
  var VOID_HANDS = [
    { hand: 'AKQJ.AKQJ.AKQJ2.-', led: 'C' },
    { hand: 'AKQJ2.-.AKQJ.AKQJ', led: 'H' },
    { hand: '-.AKQJ2.AKQJ.AKQJ', led: 'S' }
  ];
  function nextFollow() {
    if (Math.random() < 0.28) {
      var v = pick(VOID_HANDS);
      P.follow.data = { hand: B.parseHand(v.hand), ledSuit: v.led, mustFollow: false, legal: B.parseHand(v.hand) };
    } else {
      P.follow.data = B.randomFollow();
    }
    P.follow.locked = false; P.follow.hint = false; P.follow.mistake = false;
    renderFollow();
  }
  function renderFollow() {
    var f = P.follow.data, legalKeys = f.legal.map(B.cardKey);
    $('#panelFollow').innerHTML = '<div class="exercise-grid"><div class="exercise-main">' +
      '<div class="ex-title"><h2>这一轮，你出哪张？</h2><span class="ex-counter">无将定约 · 本墩首攻 ' + B.suitSymbol(f.ledSuit) + '</span></div>' +
      '<p class="ex-desc">本墩由西家领出 <strong>' + B.suitSymbol(f.ledSuit) + '</strong>，轮到你（南家）跟牌。点击下面一张你想出的牌。</p>' +
      '<div id="followHand">' + renderHand(f.hand, { pickable: true, hintLegal: P.follow.hint, legalKeys: legalKeys }) + '</div>' +
      '<div id="followFeedback"></div>' +
      '<div class="ex-actions"><button class="btn btn-outline btn-sm" id="followHint">高亮所有合法牌</button>' +
      '<button class="btn btn-primary btn-sm" id="followNext" hidden>下一题 →</button></div>' +
      '</div><div class="exercise-side">' + stats(S.followR, S.followW) +
      '<h3 style="font-size:1rem;margin-bottom:8px">先问自己一句话</h3>' +
      '<p style="font-size:.92rem;color:var(--ink-soft)"><strong>我手里还有 ' + B.suitSymbol(f.ledSuit) + ' 吗？</strong><br>' +
      '有 → 必须跟这门花色，一张都不能少；<br>没有 → 随便出（本练习为无将，只能垫牌）。</p>' +
      '<div class="callout callout-key"><strong>为什么会犯规</strong><p>初学者常因为舍不得让 A 被吃掉而改出别的花色。记住：能跟就必须跟，这是硬规则，不是策略选择。</p></div>' +
      '</div></div>';

    $('#followHint').addEventListener('click', function () {
      P.follow.hint = true;
      $$('#followHand .hand-card').forEach(function (n) {
        if (legalKeys.indexOf(n.dataset.card) < 0) n.classList.add('is-dim');
      });
      this.disabled = true;
    });
    $('#followHand').addEventListener('click', function (e) {
      var node = e.target.closest('[data-card]');
      if (!node || P.follow.locked) return;
      var key = node.dataset.card, ok = legalKeys.indexOf(key) >= 0;
      var card = f.hand.filter(function (c) { return B.cardKey(c) === key; })[0];
      if (!ok) {
        P.follow.mistake = true;
        node.classList.add('is-wrong');
        setTimeout(function () { node.classList.remove('is-wrong'); }, 450);
        $('#followFeedback').innerHTML = feedback(false, '犯规啦！', '你手里还有 ' + B.suitSymbol(f.ledSuit) +
          '，却出了 ' + B.cardLabel(card) + '。规则要求<strong>必须跟出首攻花色</strong> ' + B.suitSymbol(f.ledSuit) + '，再选一张试试。');
        return;
      }
      P.follow.locked = true;
      if (P.follow.mistake) S.followW++; else S.followR++; save();
      node.classList.add('is-right');
      $$('#followHand .hand-card').forEach(function (n) { if (n !== node) n.classList.add('is-dim'); });
      var reason = f.mustFollow
        ? '你手里有 ' + B.suitSymbol(f.ledSuit) + '，所以必须跟这门花色——' + B.cardLabel(card) + ' 合法。至于跟大的还是小的，那是策略问题，规则不管。'
        : '你这手牌<strong>没有 ' + B.suitSymbol(f.ledSuit) + '</strong>（缺门），所以不必跟牌，' + B.cardLabel(card) + ' 是合法的垫牌。若这是有将定约，你还可以出将牌将吃。';
      $('#followFeedback').innerHTML = feedback(!P.follow.mistake,
        P.follow.mistake ? '这次合法了，但本题记一次犯规' : '合法出牌 ✓', reason);
      var strip = $('#panelFollow .stat-strip');
      if (strip) strip.outerHTML = stats(S.followR, S.followW);
      $('#followNext').hidden = false;
    });
    $('#followNext').addEventListener('click', nextFollow);
  }

  /* ---------------- 练习 ④ 谁赢这墩 ---------------- */
  function nextTrick() {
    P.trick.data = B.randomTrick();
    P.trick.locked = false; P.trick.mistake = false;
    renderTrick();
  }
  function renderTrick() {
    var t = P.trick.data, w = t.winner;
    var trumpText = t.trump === 'NT' ? '无将 NT' : B.suitSymbol(t.trump) + ' ' + B.SUIT_NAME[t.trump];
    $('#panelTrick').innerHTML = '<div class="exercise-grid"><div class="exercise-main">' +
      '<div class="ex-title"><h2>这一墩，谁收走？</h2><span class="ex-counter">将牌：' + trumpText + '</span></div>' +
      '<p class="ex-desc">下面是本墩四家<strong>按出牌先后</strong>打出的牌。点击你认为赢下这墩的那张牌。</p>' +
      '<div class="trick-board" id="trickBoard">' + t.played.map(function (p, i) {
        return '<button class="trick-choose" data-idx="' + i + '"><span class="trick-label">' +
          (i === 0 ? '首攻 · ' : '第 ' + (i + 1) + ' 张 · ') + p.seat + '</span>' + cardHtml(p.card, '', true) + '</button>';
      }).join('') + '</div>' +
      '<p class="lead-flag">出牌顺序：' + t.played.map(function (p) { return p.seat; }).join(' → ') +
      '　|　首攻花色 ' + B.suitSymbol(t.played[0].card.suit) + '</p>' +
      '<div id="trickFeedback"></div>' +
      '<div class="ex-actions"><button class="btn btn-primary btn-sm" id="trickNext" hidden>下一墩 →</button>' +
      '<button class="btn btn-outline btn-sm" id="trickSkip">换一题</button></div>' +
      '</div><div class="exercise-side">' + stats(S.trickR, S.trickW) +
      '<h3 style="font-size:1rem;margin-bottom:8px">判定三步走</h3>' +
      '<ol style="font-size:.87rem;color:var(--ink-soft);padding-left:20px;line-height:1.9;margin:0">' +
      '<li>看清首攻花色是 ' + B.suitSymbol(t.played[0].card.suit) + '。</li>' +
      '<li>本墩有人出将牌吗？有 → 最大将牌赢。</li><li>没有 → 首攻花色里最大的赢。</li></ol>' +
      '<div class="callout callout-tip" style="margin-top:18px"><strong>常见陷阱</strong><p>别被别门花色的大 A 迷惑：只要不是将牌、也不是首攻花色，它永远赢不了这一墩。</p></div>' +
      '</div></div>';

    $$('#trickBoard .trick-choose').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (P.trick.locked) return;
        var i = Number(btn.dataset.idx), p = t.played[i], ok = i === w.index;
        if (!ok) {
          P.trick.mistake = true;
          btn.classList.add('is-picked');
          var pickedCard = B.cardLabel(p.card);
          $('#trickFeedback').innerHTML = feedback(false, '不是这张', '再想想：' + pickedCard + ' 是' +
            (p.card.suit === w.ledSuit ? '首攻花色' : (t.trump !== 'NT' && p.card.suit === t.trump ? '将牌' : '其他花色')) +
            '，但判定规则是「' + (t.trump === 'NT' ? '只看首攻花色' : '有将牌先看最大将牌，没有再看首攻花色') + '」。你还可以再选一次。');
          return;
        }
        P.trick.locked = true;
        if (P.trick.mistake) S.trickW++; else S.trickR++; save();
        btn.classList.add('is-picked');
        $$('#trickBoard .trick-choose').forEach(function (b, j) {
          if (j === w.index) b.style.boxShadow = '0 0 0 3px var(--gold-light)';
          else b.style.opacity = '.55';
        });
        $('#trickFeedback').innerHTML = feedback(!P.trick.mistake,
          P.trick.mistake ? '找到正确答案了，本题记一次试错' : '答对了！' + w.seat + ' 家赢下这墩',
          w.reason + '。赢家是 ' + w.seat + ' 家的 ' + B.cardLabel(w.card) + '，由他领出下一墩。');
        var strip = $('#panelTrick .stat-strip');
        if (strip) strip.outerHTML = stats(S.trickR, S.trickW);
        $('#trickNext').hidden = false;
      });
    });
    $('#trickNext').addEventListener('click', nextTrick);
    $('#trickSkip').addEventListener('click', nextTrick);
  }

  /* ---------------- 计分器 ---------------- */
  var SC = { level: 3, strain: 'NT', doubled: 0, vulnerable: false, tricks: 9 };
  function initScoring() {
    var strains = [{ v: 'C', t: '♣' }, { v: 'D', t: '♦' }, { v: 'H', t: '♥' }, { v: 'S', t: '♠' }, { v: 'NT', t: 'NT' }];
    $('#scoringLayout').innerHTML =
      '<div class="score-card"><h2>设定这副牌</h2>' +
      '<div class="field"><span class="field-label">阶数（需要赢 6 + 阶数 墩）</span><div class="seg" id="segLevel">' +
      [1, 2, 3, 4, 5, 6, 7].map(function (n) { return '<button data-v="' + n + '">' + n + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><span class="field-label">定约花色 / 将牌</span><div class="seg" id="segStrain">' +
      strains.map(function (s) { return '<button data-v="' + s.v + '"' + (B.isRedSuit(s.v) ? ' class="suit-red"' : '') + '>' + s.t + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><span class="field-label">加倍状态</span><div class="seg" id="segDbl">' +
      [{ v: 0, t: '未加倍' }, { v: 1, t: '加倍 ×' }, { v: 2, t: '再加倍 ××' }].map(function (s) { return '<button data-v="' + s.v + '">' + s.t + '</button>'; }).join('') + '</div></div>' +
      '<div class="field"><span class="field-label">局况</span><div class="seg" id="segVul">' +
      '<button data-v="0">无局</button><button data-v="1">有局</button></div></div>' +
      '<div class="field"><span class="field-label">实际拿到的墩数：<strong id="tricksVal">' + SC.tricks + ' 墩</strong></span>' +
      '<div class="range-row"><span class="muted">0</span><input type="range" id="segTricks" min="0" max="13" value="' + SC.tricks + '"><span class="muted">13</span></div></div>' +
      '<div class="callout callout-tip" style="margin:18px 0 0"><strong>试试这几个组合</strong><p>3NT / 无局 / 9 墩 = 400 分；4♠ / 有局 / 10 墩 = 620 分；3NT / 有局 / 7 墩 = 防守方 200 分。</p></div>' +
      '</div><div id="scoreResult"></div>';

    $('#scoreNotes').innerHTML = D.scoreNotes.map(function (n) {
      return '<div class="note-card"><h4>' + n.title + '</h4><p>' + n.text + '</p></div>';
    }).join('');

    function bindSeg(id, key, isNum) {
      $('#' + id).addEventListener('click', function (e) {
        var b = e.target.closest('button[data-v]'); if (!b) return;
        SC[key] = isNum ? Number(b.dataset.v) : b.dataset.v;
        if (key === 'vulnerable') SC.vulnerable = b.dataset.v === '1';
        $$('#' + id + ' button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        if (key === 'level') { SC.tricks = B.neededTricks(SC.level); $('#segTricks').value = SC.tricks; $('#tricksVal').textContent = SC.tricks + ' 墩'; }
        updateScore();
      });
    }
    bindSeg('segLevel', 'level', true);
    bindSeg('segStrain', 'strain', false);
    bindSeg('segDbl', 'doubled', true);
    bindSeg('segVul', 'vulnerable', false);
    $('#segTricks').addEventListener('input', function () {
      SC.tricks = Number(this.value); $('#tricksVal').textContent = SC.tricks + ' 墩'; updateScore();
    });
    syncSegs(); updateScore();
  }
  function syncSegs() {
    [['segLevel', SC.level], ['segStrain', SC.strain], ['segDbl', SC.doubled], ['segVul', SC.vulnerable ? 1 : 0]].forEach(function (p) {
      $$('#' + p[0] + ' button').forEach(function (b) { b.classList.toggle('is-on', String(b.dataset.v) === String(p[1])); });
    });
  }
  function updateScore() {
    var r = B.score(SC);
    var made = r.made;
    var headline = made ? '+' + r.declarerPoints : '+' + r.defenderPoints;
    var who = made ? '庄家方得分' : '防守方得分';
    var sub = '定约 ' + r.label + '，需要 ' + r.needed + ' 墩，实拿 ' + r.tricks + ' 墩' +
      (made ? (r.overtricks ? '，超 ' + r.overtricks + ' 墩' : '，正好完成') : '，宕 ' + r.undertricks + ' 墩');
    var rows = r.breakdown.map(function (x) {
      return '<div class="breakdown-row"><span>' + x.label + '</span><b>' + (x.value >= 0 ? '+' : '') + x.value + '</b></div>';
    }).join('');
    $('#scoreResult').innerHTML = '<div class="result-card"><h2>' + who + '</h2>' +
      '<div class="result-headline">' + headline + '<small>分</small></div>' +
      '<div class="result-sub">' + sub + '</div>' +
      '<div class="breakdown">' + rows +
      '<div class="breakdown-row total"><span>合计</span><b>' + headline + '</b></div></div>' +
      '<p class="result-note">定约墩分 ' + r.contractBase + ' 分 · ' +
      (r.game ? '已达 100 分成局线' : '未达成局线，属部分定约') + ' · ' +
      (r.vulnerable ? '有局' : '无局') + (r.doubled ? ' · ' + (r.doubled === 2 ? '再加倍' : '加倍') : '') +
      '<br>本站按复式桥牌单副牌计算，不含部分分合并与队式 IMP 转换。</p></div>';
  }

  /* ---------------- 术语表 ---------------- */
  var G = { q: '', cat: '全部' };
  function initGlossary() {
    var cats = ['全部'].concat(D.glossary.map(function (g) { return g.cat; }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
    $('#glossaryFilters').innerHTML = cats.map(function (c) {
      return '<button class="chip' + (c === G.cat ? ' is-on' : '') + '" data-cat="' + c + '">' + c + '</button>';
    }).join('');
    $('#glossaryFilters').addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      G.cat = b.dataset.cat;
      $$('#glossaryFilters .chip').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      renderGlossary();
    });
    $('#glossarySearch').addEventListener('input', function () { G.q = this.value.trim().toLowerCase(); renderGlossary(); });
    $('#glossaryGrid').addEventListener('click', function (e) {
      var card = e.target.closest('.gloss-card'); if (card) card.classList.toggle('is-open');
    });
    renderGlossary();
  }
  function renderGlossary() {
    var list = D.glossary.filter(function (g) {
      var catOk = G.cat === '全部' || g.cat === G.cat;
      var qOk = !G.q || (g.term + g.en + g.brief + g.detail + g.cat).toLowerCase().indexOf(G.q) >= 0;
      return catOk && qOk;
    });
    $('#glossaryGrid').innerHTML = list.map(function (g) {
      return '<div class="gloss-card"><div class="gloss-top"><h3>' + g.term + '</h3><span class="gloss-en">' + esc(g.en) + '</span></div>' +
        '<p class="gloss-brief">' + g.brief + '</p><span class="gloss-cat">' + g.cat + '</span>' +
        '<div class="gloss-detail">' + g.detail + '</div></div>';
    }).join('');
    $('#glossaryEmpty').hidden = list.length > 0;
  }

  /* ---------------- 综合测验 ---------------- */
  var Q = { order: [], idx: 0, answers: [], started: false, finished: false };
  function startQuiz() {
    Q.order = B.shuffle(D.quiz.map(function (_, i) { return i; }));
    Q.idx = 0; Q.answers = []; Q.started = true; Q.finished = false;
    renderQuiz();
  }
  function renderQuiz() {
    var root = $('#quizRoot');
    if (!Q.started) {
      root.innerHTML = '<div class="quiz-shell quiz-result">' +
        (S.quizBest !== null ? '<span class="best-badge">本机最好成绩：' + S.quizBest + ' / ' + D.quiz.length + '</span>' : '') +
        '<h2>准备好了吗？</h2><p>共 ' + D.quiz.length + ' 道单选题，涵盖牌点、叫牌、打牌与计分。点选即判分，交卷后逐题给解析。</p>' +
        '<div class="ex-actions" style="justify-content:center"><button class="btn btn-primary" id="quizStart">开始测验 →</button>' +
        '<a class="btn btn-outline" href="#/lessons">先复习课程</a></div></div>';
      $('#quizStart').addEventListener('click', startQuiz);
      return;
    }
    if (Q.finished) { renderQuizResult(); return; }
    var qi = D.quiz[Q.order[Q.idx]], pct = Math.round(Q.idx / D.quiz.length * 100);
    root.innerHTML = '<div class="quiz-shell">' +
      '<div class="quiz-bar-wrap"><span>第 ' + (Q.idx + 1) + ' / ' + D.quiz.length + ' 题 · ' + qi.cat + '</span><span>已答 ' + Q.answers.length + ' 题</span></div>' +
      '<div class="quiz-bar"><div class="quiz-bar-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="quiz-qnum">QUESTION ' + String(Q.idx + 1).padStart(2, '0') + '</div>' +
      '<h2 class="quiz-question">' + qi.q + '</h2>' +
      (qi.hand ? '<div class="quiz-hand">' + renderHand(B.parseHand(qi.hand)) + '</div>' : '') +
      optionsHtml(qi.options.map(function (o) { return { label: o }; })) +
      '<div id="quizFeedback"></div>' +
      '<div class="quiz-actions"><button class="btn btn-primary btn-sm" id="quizNext" hidden>' +
      (Q.idx === D.quiz.length - 1 ? '查看结果 →' : '下一题 →') + '</button>' +
      '<span class="muted" id="quizHint">选择一个答案</span></div></div>';

    $$('#quizRoot .option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (Q.answers[Q.idx] !== undefined) return;
        var i = Number(btn.dataset.idx), ok = i === qi.answer;
        Q.answers[Q.idx] = { chosen: i, ok: ok };
        $$('#quizRoot .option').forEach(function (b, j) {
          b.disabled = true;
          if (j === qi.answer) b.classList.add('is-correct');
          else if (j === i) b.classList.add('is-wrong');
          else b.classList.add('is-muted');
        });
        $('#quizFeedback').innerHTML = feedback(ok, ok ? '答对了 ✓' : '答错了', qi.explain);
        $('#quizNext').hidden = false;
        $('#quizHint').textContent = ok ? '继续保持' : '别灰心，看看解析';
      });
    });
    $('#quizNext').addEventListener('click', function () {
      if (Q.idx === D.quiz.length - 1) { Q.finished = true; finishQuiz(); }
      else { Q.idx++; renderQuiz(); }
    });
  }
  function finishQuiz() {
    var right = Q.answers.filter(function (a) { return a && a.ok; }).length;
    if (S.quizBest === null || right > S.quizBest) { S.quizBest = right; save(); toast('新纪录！' + right + ' / ' + D.quiz.length); }
    renderQuizResult();
  }
  function renderQuizResult() {
    var right = Q.answers.filter(function (a) { return a && a.ok; }).length;
    var pct = Math.round(right / D.quiz.length * 100);
    var comment = pct >= 90 ? '漂亮，你已经可以坐上牌桌了。' : pct >= 70 ? '基础很扎实，回去补一补错题就完美了。' :
      pct >= 50 ? '框架已经建立，建议重读对应章节再做一遍。' : '别急，桥牌本来就需要一点时间——从「数点」练起最快。';
    var review = Q.order.map(function (qi, i) {
      var q = D.quiz[qi], a = Q.answers[i] || { chosen: -1, ok: false };
      return '<div class="review-item' + (a.ok ? ' is-ok' : '') + '"><b>' + (a.ok ? '✓ ' : '✗ ') + (i + 1) + '. ' + q.q + '</b>' +
        '<span>你的答案：' + (a.chosen >= 0 ? q.options[a.chosen] : '未答') + '　|　正确答案：' + q.options[q.answer] + '</span>' +
        '<p>' + q.explain + '</p></div>';
    }).join('');
    $('#quizRoot').innerHTML = '<div class="quiz-shell quiz-result">' +
      '<div class="result-ring" style="--p:' + pct + '%"><span>' + right + '/' + D.quiz.length + '</span></div>' +
      '<h2>正确率 ' + pct + '%</h2><p>' + comment + '</p>' +
      '<div class="ex-actions" style="justify-content:center"><button class="btn btn-primary" id="quizAgain">再做一遍</button>' +
      '<a class="btn btn-outline" href="#/practice">去互动练习</a></div>' +
      '<div class="review-list"><h3 style="font-size:1.05rem;margin-bottom:4px">逐题解析</h3>' + review + '</div></div>';
    $('#quizAgain').addEventListener('click', startQuiz);
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    var view = parts[0] || 'home', arg = parts[1] || '';
    if (!['home', 'lessons', 'practice', 'scoring', 'glossary', 'quiz'].includes(view)) view = 'home';
    $$('.view').forEach(function (v) { v.classList.toggle('is-active', v.dataset.view === view); });
    $$('#nav a').forEach(function (a) { a.classList.toggle('is-active', a.dataset.nav === view); });
    $('#nav').classList.remove('is-open');
    $('#menuToggle').setAttribute('aria-expanded', 'false');
    if (view === 'lessons') renderLesson(arg);
    if (view === 'practice') {
      var tab = ['hcp', 'bid', 'follow', 'trick'].includes(arg) ? arg : 'hcp';
      setTab(tab);
    }
    if (view === 'quiz' && !Q.started) renderQuiz();
    if (view === 'glossary') renderGlossary();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
  function setTab(tab) {
    $$('#practiceTabs .tab').forEach(function (b) { b.classList.toggle('is-active', b.dataset.tab === tab); });
    $$('.panel').forEach(function (p) { p.classList.toggle('is-active', p.dataset.panel === tab); });
  }

  /* ---------------- 初始化 ---------------- */
  function init() {
    refreshProgress();
    initHome();
    initScoring();
    initGlossary();

    newHcpHand(); nextBid(); nextFollow(); nextTrick();
    renderQuiz();

    $('#practiceTabs').addEventListener('click', function (e) {
      var b = e.target.closest('.tab'); if (!b) return;
      setTab(b.dataset.tab);
    });
    $('#menuToggle').addEventListener('click', function () {
      var open = $('#nav').classList.toggle('is-open');
      this.setAttribute('aria-expanded', String(open));
    });
    $('#resetProgress').addEventListener('click', function () {
      if (!window.confirm('确定清空本机保存的课程进度与练习成绩吗？此操作不可撤销。')) return;
      S = JSON.parse(JSON.stringify(defaults)); save();
      refreshProgress(); renderPath(); renderToc(D.lessons[0].id);
      Q = { order: [], idx: 0, answers: [], started: false, finished: false }; renderQuiz();
      renderHcp(); renderBid(); renderFollow(); renderTrick();
      toast('学习记录已清空');
    });
    window.addEventListener('hashchange', route);
    route();
  }

  init();
})();
