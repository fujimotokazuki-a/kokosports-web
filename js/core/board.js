/* ココスポーツ 本番：運営ボード（B01〜B07）の数字。オーナー・娘さん・本人が見る
   B01 概要／B02 集客／B03 予約／B04 売上／B05 お客様／B06 声／B07 今週の3つの数字
   売上は「予約と取り置きから見込める額」。実際の会計はAirレジ（つなぎは別の段階） */
KS.core.board = (function () {
  var u = KS.core.u, c = KS.core.c, N = KS.core.notify;

  function months(ctx, n) {
    var d = ctx.now().date, out = [], y = +d.slice(0, 4), m = +d.slice(5, 7);
    for (var i = n - 1; i >= 0; i--) { var mm = m - i, yy = y; while (mm <= 0) { mm += 12; yy--; } out.push(yy + '-' + u.pad(mm)); }
    return out;
  }
  function inMonth(s, m) { return String(s || '').slice(0, 7) === m; }

  function data(ctx, args) {
    var M = months(ctx, 6), now = ctx.now(), today = now.date;
    var cs = ctx.db.all('customers').filter(function (x) { return !x.mergedInto; });
    var orders = ctx.db.all('orders'), salon = ctx.db.all('salonBookings'), measure = ctx.db.all('measureBookings'), waits = ctx.db.all('waits'), reviews = ctx.db.all('reviews');
    var okOrder = function (o) { return o.status !== '取り消し' && o.status !== '支払い待ち'; };

    /* B02 集客：LINEの友だち（このしくみで分かった人）・学校ごと・どこで知ったか */
    var lineFriends = cs.filter(function (x) { return x.lineUserId && !x.blocked; }).length;
    var blocked = cs.filter(function (x) { return x.lineUserId && x.blocked; }).length;
    var bySchool = ctx.db.all('schools').sort(u.by('sort')).map(function (s) {
      return { school: s.short, people: cs.filter(function (x) { return x.schoolId === s.id; }).length, orders: orders.filter(function (o) { return okOrder(o) && o.lines.some(function (l) { var p = c.product(ctx, l.productId); return p && p.schoolId === s.id; }); }).length, waits: waits.filter(function (w) { return w.schoolId === s.id; }).length };
    });
    var heard = {};
    cs.forEach(function (x) { var k = x.heardFrom || x.firstSource || '不明'; heard[k] = (heard[k] || 0) + 1; });
    var newByMonth = M.map(function (m) { return [m.slice(5) + '月', cs.filter(function (x) { return inMonth(x.createdAt, m); }).length]; });

    /* B03 予約：サロン（月別・メニュー別・取り消し率）、取り置き、採寸、入荷のお知らせ→予約率 */
    var salonByMonth = M.map(function (m) { return [m.slice(5) + '月', salon.filter(function (b) { return inMonth(b.date, m) && (b.status === '予約' || b.status === '来店済み'); }).length]; });
    var menuCount = {};
    salon.forEach(function (b) { if (b.status === '予約' || b.status === '来店済み') menuCount[b.menuName] = (menuCount[b.menuName] || 0) + 1; });
    var salonAll = salon.length, salonCancel = salon.filter(function (b) { return String(b.status).indexOf('取り消し') === 0 || b.status === '無断キャンセル'; }).length;
    var notified = waits.filter(function (w) { return w.status === 'お知らせ済み' || w.status === '予約済み' || (w.status === '終了' && w.notifiedAt); }).length;
    var converted = waits.filter(function (w) { return w.status === '予約済み'; }).length;
    var ordersByMonth = M.map(function (m) { return [m.slice(5) + '月', orders.filter(function (o) { return okOrder(o) && inMonth(o.createdDate, m); }).length]; });
    var channel = { LINE: 0, Web: 0, 電話: 0, 店頭: 0 };
    orders.filter(okOrder).forEach(function (o) { channel[o.channel] = (channel[o.channel] || 0) + 1; });
    salon.forEach(function (b) { if (b.status === '予約' || b.status === '来店済み') channel[b.channel] = (channel[b.channel] || 0) + 1; });

    /* B04 売上（見込み） */
    var salesByMonth = M.map(function (m) {
      var g = u.sum(orders.filter(function (o) { return okOrder(o) && inMonth(o.createdDate, m); }), function (o) { return o.total; });
      var s = u.sum(salon.filter(function (b) { return inMonth(b.date, m) && b.status === '来店済み'; }), function (b) { return b.price; });
      return { month: m, goods: g, salon: s };
    });
    var prepaid = u.sum(orders.filter(function (o) { return o.payStatus === '支払い済み'; }), function (o) { return o.total; });

    /* B05 お客様：新しい方・2回目以上 */
    var visits = {};
    salon.forEach(function (b) { if (b.status === '来店済み') visits[b.customerId] = (visits[b.customerId] || 0) + 1; });
    var repeaters = Object.keys(visits).filter(function (k) { return visits[k] >= 2; }).length;
    var visitors = Object.keys(visits).length;

    /* B06 声 */
    var avg = reviews.length ? Math.round(u.sum(reviews, function (r) { return r.stars; }) / reviews.length * 10) / 10 : 0;

    /* B07 今週の3つの数字 */
    var wk = u.addDays(today, -6);
    var thisWeek = function (s) { return s && String(s).slice(0, 10) >= wk && String(s).slice(0, 10) <= today; };
    var three = [
      { name: '新しく友だちになった方', value: cs.filter(function (x) { return x.lineUserId && thisWeek(x.createdAt); }).length, unit: '人', note: 'このしくみを開いた方の数（公式LINEの管理画面の友だち数とは違う）' },
      { name: '取り置き・予約の受付', value: orders.filter(function (o) { return okOrder(o) && thisWeek(o.createdDate); }).length + salon.filter(function (b) { return thisWeek(b.createdDate); }).length + measure.filter(function (b) { return thisWeek(b.createdAt); }).length, unit: '件', note: '取り置き・サロン・採寸の合計' },
      { name: '入荷のお知らせから取り置き', value: converted, unit: '件', note: 'お知らせした ' + notified + ' 件のうち' }
    ];

    var upcomingSalon = salon.filter(function (b) { return b.status === '予約' && b.date >= today; }).length;
    var openOrders = orders.filter(function (o) { return o.status === '受付' || o.status === '用意済み'; }).length;
    return {
      ok: true, months: M, today: today,
      summary: { customers: cs.length, lineFriends: lineFriends, blocked: blocked, upcomingSalon: upcomingSalon, openOrders: openOrders, waiting: waits.filter(function (w) { return w.status === '待ち'; }).length, reviews: reviews.length, avgStars: avg, quota: N.quota(ctx) },
      reach: { bySchool: bySchool, heard: Object.keys(heard).map(function (k) { return [k, heard[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), newByMonth: newByMonth },
      bookings: { salonByMonth: salonByMonth, menus: Object.keys(menuCount).map(function (k) { return [k, menuCount[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), salonCancelRate: salonAll ?Math.round(salonCancel / salonAll * 1000) / 10 : 0, ordersByMonth: ordersByMonth, measure: measure.filter(function (b) { return b.status === '予約'; }).length, restock: { notified: notified, converted: converted }, channel: Object.keys(channel).map(function (k) { return [k, channel[k]]; }) },
      sales: { byMonth: salesByMonth, prepaid: prepaid },
      people: { visitors: visitors, repeaters: repeaters, repeatRate: visitors ? Math.round(repeaters / visitors * 1000) / 10 : 0, newByMonth: newByMonth },
      voice: { count: reviews.length, avg: avg, stars: [5, 4, 3, 2, 1].map(function (s) { return [s + '点', reviews.filter(function (r) { return r.stars === s; }).length]; }), latest: reviews.slice(-10).reverse() },
      three: three
    };
  }

  return { data: data };
})();
