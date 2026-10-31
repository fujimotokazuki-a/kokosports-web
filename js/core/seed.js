/* ココスポーツ 本番：最初に入れる行
   - initial(false) …… 本番の最初（学校・仮の品物・在庫0・メニュー）。お客様のデータは入れない
   - initial(true)  …… 試しの形（見本のお客様・予約・取り置き・入荷待ち・声を足す。名前はすべて架空） */
KS.core.seed = (function () {
  var u = KS.core.u, M = KS.core.model;

  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function initial(withSamples, nowTs) {
    var T = {}, seq = {};
    Object.keys(M.TABLES).forEach(function (k) { T[k] = []; });
    function id(p) { seq[p] = (seq[p] || 0) + 1; return idOf(p, seq[p], nowTs); }
    T.schools = M.SCHOOLS.map(function (s) { return u.clone(s); });
    T.products = M.products();
    T.salonMenus = M.salonMenus();
    var r = rng(20261101);
    T.products.forEach(function (p) {
      if (p.needsMeasure) return;
      p.sizes.forEach(function (z, i) {
        var q = withSamples ? Math.max(0, Math.round(r() * 6) - (i === p.sizes.length - 1 ? 3 : 0)) : 0;
        T.stock.push({ id: p.id + '|' + z, productId: p.id, size: z, qty: q, updatedAt: '', updatedBy: '最初の値' });
      });
    });
    T.settings.push({ key: 'sampleData', value: JSON.stringify(!!withSamples) });
    if (!withSamples) return { tables: T, seq: seq };

    var now = u.nowOf(nowTs), today = now.date;
    /* 臨時休業と採寸の枠（見本） */
    T.holidays.push({ date: u.addDays(today, 12), reason: '臨時休業（見本）' });
    var slotDays = [5, 6, 8].map(function (d) { return u.addDays(today, d); });
    ['kamisu2', 'kamisu4'].forEach(function (sid, k) {
      slotDays.forEach(function (d) {
        if ([0, 4].indexOf(u.wd(d)) >= 0) return;
        [600, 660, 780, 840, 900].forEach(function (t) { T.measureSlots.push({ id: id('J'), schoolId: sid, date: d, start: t + k * 30, end: t + k * 30 + 30, capacity: 2 }); });
      });
    });

    /* 見本のお客様（架空） */
    var FAM = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '斎藤'];
    var KANA = ['サトウ', 'スズキ', 'タカハシ', 'タナカ', 'イトウ', 'ワタナベ', 'ヤマモト', 'ナカムラ', 'コバヤシ', 'カトウ', 'ヨシダ', 'ヤマダ', 'ササキ', 'ヤマグチ', 'マツモト', 'イノウエ', 'キムラ', 'ハヤシ', 'シミズ', 'サイトウ'];
    var GIV = ['花子', '美咲', '陽子', '恵', '由美', '直美', '健太', '翔', '真理', '彩'];
    var HEARD = ['Instagram', 'Instagram', 'Instagram', 'LINE', '学校のチラシ', '知り合いから', 'お店の前を通って', 'Googleマップ'];
    var schoolIds = M.SCHOOLS.map(function (s) { return s.id; });
    for (var i = 0; i < 28; i++) {
      var line = i % 3 !== 2, k = i % FAM.length;
      T.customers.push({
        id: id('C'), lineUserId: line ? 'Udemo' + (1000 + i) : '', lineName: line ? FAM[k] + '（LINE）' : '', name: FAM[k] + ' ' + GIV[i % GIV.length], kana: KANA[k] + ' ' + 'ハナコ',
        phone: '0900000' + String(1000 + i).slice(-4), email: line ? '' : 'sample' + i + '@example.com', schoolId: i < 18 ? schoolIds[i % schoolIds.length] : '',
        firstSource: line ? 'LINE' : (i % 2 ? 'instagram' : 'Web'), heardFrom: HEARD[i % HEARD.length], createdAt: u.addDays(today, -Math.floor(r() * 70)),
        blocked: i === 7, memo: '', marketingOk: false, mergedInto: ''
      });
    }
    var C = T.customers;

    /* サロンの予約：過去60日と、これから14日 */
    var menus = T.salonMenus, W = [[2, 30], [3, 32], [1, 14], [5, 6], [4, 6], [6, 6], [7, 6]];
    function pickMenu() { var x = r() * 100; for (var j = 0; j < W.length; j++) { x -= W[j][1]; if (x <= 0) return menus[W[j][0] - 1]; } return menus[1]; }
    var seatsUsed = {};
    function canPut(d, s, m) {
      var used = 0; for (var t = s; t < s + m.hold; t += 30) used = Math.max(used, seatsUsed[d + t] || 0);
      return used + m.seats <= 2;
    }
    function put(d, s, m) { for (var t = s; t < s + m.hold; t += 30) seatsUsed[d + t] = (seatsUsed[d + t] || 0) + m.seats; }
    for (var dd = -60; dd <= 14; dd++) {
      var d = u.addDays(today, dd);
      if ([1, 2, 3, 5, 6].indexOf(u.wd(d)) < 0) continue;
      var n = Math.floor(r() * 4) + (dd > 0 ? 0 : 1);
      for (var q = 0; q < n; q++) {
        var m = pickMenu(), start = 600 + Math.floor(r() * 14) * 30;
        if (start + m.hold > 1080 || !canPut(d, start, m)) continue;
        var cu = C[Math.floor(r() * C.length)];
        var past = dd < 0 || (dd === 0 && start < now.min);
        var st = past ? (r() < 0.9 ? '来店済み' : (r() < 0.5 ? '取り消し（お客様）' : '無断キャンセル')) : '予約';
        if (st !== '取り消し（お客様）') put(d, start, m);
        T.salonBookings.push({
          id: id('R'), token: u.token(), customerId: cu.id, menuId: m.id, menuName: m.name, date: d, start: start, end: start + m.mins, holdUntil: start + m.hold,
          seatIds: m.seats === 2 ? ['S1', 'S2'] : [(seatsUsed[d + start] || 1) > 1 ? 'S2' : 'S1'], party: m.seats, status: st,
          channel: cu.lineUserId ? 'LINE' : (r() < 0.5 ? 'Web' : '電話'), heardFrom: cu.heardFrom, note: '', price: m.price,
          createdAt: u.addDays(d, -Math.floor(r() * 10) - 1) + ' 12:00', createdDate: u.addDays(d, -Math.floor(r() * 10) - 1), reminded: past, utm: null,
          contact: { name: cu.name, phone: cu.phone, email: cu.email }
        });
      }
    }

    /* 取り置き（見本） */
    function prod(sid, name) { return T.products.filter(function (p) { return p.schoolId === sid && p.name === name; })[0]; }
    function order(ci, items, method, pickupDays, status, pay, payStatus, daysAgo) {
      var Cm = KS.core.c, cu = C[ci], lines = items.map(function (it) { var p = prod(it[0], it[1]); return { productId: p.id, size: it[2], qty: it[3], price: Cm.priceOf(p, it[2]), name: p.name, label: shortOf(it[0]) + ' ' + p.name + '（' + Cm.sizeLabel(p, it[2]) + '）', waitId: '' }; });
      var goods = u.sum(lines, function (l) { return l.price * l.qty; }), fee = method === '配送' ? 930 : 0;
      T.orders.push({
        id: id('T'), token: u.token(), customerId: cu.id, lines: lines, method: method, pickupDate: method === '店頭' ? u.addDays(today, pickupDays) : '',
        ship: method === '配送' ? { methodId: 'box', method: '宅配便（60サイズ）', fee: fee, zip: '3140000', addr: '茨城県神栖市（見本）', to: cu.name, tracking: '' } : null,
        pay: pay, payStatus: payStatus, payRef: pay === '事前' ? 'sq_demo_' + ci : '', payUrl: '', payDeadline: 0, status: status, goods: goods, shipFee: fee, total: goods + fee,
        contact: { name: cu.name, phone: cu.phone, email: cu.email }, channel: cu.lineUserId ? 'LINE' : 'Web', utm: null, note: '',
        createdAt: u.addDays(today, -daysAgo) + ' 19:20', createdDate: u.addDays(today, -daysAgo), remindedDayBefore: pickupDays <= 0, noShowNotified: pickupDays < 0, cancelReason: '', doneAt: '', legalVersion: 'v1'
      });
    }
    function shortOf(sid) { return M.SCHOOLS.filter(function (s) { return s.id === sid; })[0].short; }
    order(0, [['ikisu', '体操服 半そで', '120', 2], ['ikisu', '体操服 半ズボン', '120', 2], ['ikisu', '体操服 長そで', '130', 1]], '店頭', 0, '用意済み', '店頭', '店頭で', 3);
    order(1, [['kamisu2', '体操服 半袖', 'M', 2], ['kamisu2', 'ジャージ 上', 'M', 1]], '店頭', 2, '受付', '店頭', '店頭で', 1);
    order(3, [['fukashiba', '体操服 半そで', '130', 1]], '店頭', 0, '受付', '事前', '支払い済み', 2);
    order(4, [['onohara', '体操服 半ズボン', '140', 2]], '店頭', -2, '受付', '店頭', '店頭で', 6);
    order(5, [['kamisu4', 'ジャージ 下', 'L', 1]], '配送', 0, '受付', '事前', '支払い済み', 1);
    order(8, [['onoharanishi', '体育館シューズ', '21.0', 1], ['onoharanishi', '体操服 長ズボン', '175', 1]], '店頭', -5, '受け取り済み', '店頭', '店頭で', 9);
    order(9, [['ikisu', '体操服 半そで', '140', 1]], '店頭', 4, '取り消し', '店頭', '店頭で', 4);
    T.orders[T.orders.length - 1].cancelReason = 'お客様が取り消し';
    order(10, [['kamisu2', '体操服 半ズボン', 'L', 1]], '配送', 0, '発送済み', '事前', '支払い済み', 8);

    /* 入荷待ち（見本）：品切れのサイズに */
    var zero = T.stock.filter(function (s) { return s.qty === 0; });
    for (var w = 0; w < Math.min(8, zero.length); w++) {
      var s = zero[w], p = T.products.filter(function (x) { return x.id === s.productId; })[0], cu2 = C[(w * 3) % C.length];
      T.waits.push({ id: id('W'), token: u.token(), customerId: cu2.id, schoolId: p.schoolId, productId: p.id, size: s.size, createdAt: u.addDays(today, -w - 1) + ' 20:00', createdTs: nowTs - (w + 1) * 86400000, status: '待ち', notifiedAt: '', priorityUntil: 0, channel: cu2.lineUserId ? 'LINE' : 'メール' });
    }
    /* 採寸の予約（見本） */
    if (T.measureSlots.length) {
      T.measureBookings.push({ id: id('M'), token: u.token(), slotId: T.measureSlots[0].id, schoolId: T.measureSlots[0].schoolId, date: T.measureSlots[0].date, start: T.measureSlots[0].start, end: T.measureSlots[0].end, customerId: C[1].id, count: 1, children: '鈴木 そうた', status: '予約', createdAt: u.addDays(today, -1) + ' 21:10', reminded: false, contact: { name: C[1].name, phone: C[1].phone, email: '' }, note: '' });
    }
    /* お客様の声（見本）。点数で案内を分けない */
    var past2 = T.salonBookings.filter(function (b) { return b.status === '来店済み'; }).slice(-8);
    var TX = ['個室で落ち着けました。', 'スタッフの方の説明が丁寧でした。', '予約がしやすかったです。', '', '駐車場が分かりやすいとうれしいです。', 'また来ます。', '', '子どもの体操服も一緒に見られて便利でした。'];
    past2.forEach(function (b, j) { T.reviews.push({ id: id('V'), at: b.date + ' 19:00', date: b.date, customerId: b.customerId, refId: b.id, stars: [5, 5, 4, 5, 3, 5, 4, 5][j], text: TX[j], toShop: j === 4 ? '駐車場の案内があると助かります' : '', source: '予約' }); });
    /* お知らせの記録（見本）：今月の前日のお知らせ・入荷 */
    for (var nn = 0; nn < 14; nn++) T.notices.push({ id: id('N'), at: u.addDays(today, -nn) + ' 17:00', kind: nn % 4 === 0 ? '入荷' : '前日', template: '', customerId: C[nn].id, refId: '', channel: C[nn].lineUserId ? 'LINE' : 'メール', mode: C[nn].lineUserId ? 'push' : 'mail', count: C[nn].lineUserId ? 1 : 0, status: '送信済み', text: '（見本）', error: '' });
    return { tables: T, seq: seq };
  }

  /* 番号の形：受付番号は「T2611-0001」のように年月つき。ほかは頭の字＋番号 */
  function idOf(p, n, ts) {
    var d = u.nowOf(ts || Date.now()).date;
    if (p === 'T' || p === 'R' || p === 'M') return p + d.slice(2, 4) + d.slice(5, 7) + '-' + ('000' + n).slice(-4);
    return p + ('00000' + n).slice(-6);
  }

  return { initial: initial, idOf: idOf };
})();
