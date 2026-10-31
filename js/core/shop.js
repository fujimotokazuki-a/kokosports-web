/* ココスポーツ 本番：店の画面（S01〜S08）の裏側。お母さんのスマホで使う前提 */
KS.core.shop = (function () {
  var u = KS.core.u, c = KS.core.c, G = KS.core.goods, B = KS.core.booking, N = KS.core.notify;

  function custBrief(ctx, id) {
    var x = ctx.db.get('customers', id);
    return x ? { id: x.id, name: c.nameOf(x), phone: x.phone, email: x.email, line: !!x.lineUserId, blocked: !!x.blocked } : { id: id, name: '（不明）' };
  }
  function orderRow(ctx, o) {
    var v = G.view(ctx, o); v.customer = custBrief(ctx, o.customerId); v.channel = o.channel; v.note = o.note; v.utm = o.utm; v.payRef = o.payRef; return v;
  }
  function salonRow(ctx, b) {
    var v = B.salonView(ctx, b); v.customer = custBrief(ctx, b.customerId); v.channel = b.channel; v.seatIds = b.seatIds; v.note = b.note; v.heardFrom = b.heardFrom; return v;
  }
  function measureRow(ctx, b) { var v = B.measureView(ctx, b); v.customer = custBrief(ctx, b.customerId); return v; }

  /* S01 今日：受け取り → サロン → 発送 → 新しい取り置き → 期限が近いもの */
  function today(ctx, args) {
    var now = ctx.now(), d = (args && args.date) || now.date;
    var orders = ctx.db.all('orders');
    var pickups = orders.filter(function (o) { return o.method === '店頭' && o.pickupDate === d && (o.status === '受付' || o.status === '用意済み' || o.status === '受け取り済み'); }).map(function (o) { return orderRow(ctx, o); });
    var salon = ctx.db.all('salonBookings').filter(function (b) { return b.date === d && b.status !== '取り消し（お客様）' && b.status !== '取り消し（店）'; }).sort(u.by('start')).map(function (b) { return salonRow(ctx, b); });
    var measure = ctx.db.all('measureBookings').filter(function (b) { return b.date === d && b.status !== '取り消し'; }).sort(u.by('start')).map(function (b) { return measureRow(ctx, b); });
    var ship = orders.filter(function (o) { return o.method === '配送' && o.status === '受付' && o.payStatus === '支払い済み'; }).map(function (o) { return orderRow(ctx, o); });
    var fresh = orders.filter(function (o) { return o.status === '受付' && o.method === '店頭' && o.pickupDate !== d; }).map(function (o) { return orderRow(ctx, o); }).reverse();
    var cf = c.cfg(ctx);
    var nearing = orders.filter(function (o) { return o.method === '店頭' && (o.status === '受付' || o.status === '用意済み') && o.pickupDate && o.pickupDate < d; }).map(function (o) {
      var r = orderRow(ctx, o); r.daysLate = u.daysBetween(o.pickupDate, d); r.daysLeft = cf.pickup.keepDays - r.daysLate; return r;
    });
    var waitsNotified = ctx.db.all('waits').filter(function (w) { return w.status === 'お知らせ済み'; }).length;
    return { ok: true, date: d, open: c.isOpen(ctx, d), pickups: pickups, salon: salon, measure: measure, ship: ship, fresh: fresh, nearing: nearing, quota: N.quota(ctx), waitsNotified: waitsNotified };
  }

  /* S02 カレンダー（日・週）：サロン2席×30分、採寸の枠、ブロック、受け取り */
  function calendar(ctx, args) {
    var from = args.from || ctx.now().date, n = Math.max(1, Math.min(7, +args.days || 1)), cf = c.cfg(ctx), out = [];
    for (var i = 0; i < n; i++) {
      var d = u.addDays(from, i);
      out.push({
        date: d, open: c.isOpen(ctx, d), why: c.isOpen(ctx, d) ? '' : (c.holidayReason(ctx, d) || '定休日'),
        salon: ctx.db.all('salonBookings').filter(function (b) { return b.date === d && B.active(b); }).sort(u.by('start')).map(function (b) { return salonRow(ctx, b); }),
        blocks: ctx.db.all('salonBlocks').filter(function (b) { return b.date === d; }),
        measureSlots: ctx.db.all('measureSlots').filter(function (s) { return s.date === d; }).map(function (s) { var sc = c.school(ctx, s.schoolId); return { id: s.id, school: sc ? sc.short : '', start: s.start, end: s.end, capacity: s.capacity, used: B.slotUsed(ctx, s.id) }; }),
        pickups: ctx.db.all('orders').filter(function (o) { return o.pickupDate === d && (o.status === '受付' || o.status === '用意済み'); }).length
      });
    }
    return { ok: true, from: from, days: out, seats: cf.salon.seats, open: cf.open, close: cf.close, step: cf.salon.step, menus: B.menus(ctx, true) };
  }

  /* S03 予約を入れる・変える（電話・店頭）、席の押さえ */
  function salonCreate(ctx, args) { var f = args.form || {}; f.channel = f.channel || '電話'; return B.salonBook(ctx, { form: f, asShop: true }); }
  function salonWeekShop(ctx, args) {
    var m = B.menu(ctx, args.menuId); if (!m) return u.fail('メニューを選んでください。', 'menu');
    var d = args.date || ctx.now().date;
    return { ok: true, date: d, menu: m, slots: B.startTimes(ctx, m).map(function (t) { var s = B.slotState(ctx, d, t, m, { asShop: true, ignoreId: args.ignoreId }); return { start: t, mark: s.mark, ok: s.ok, why: s.why }; }) };
  }
  function salonSet(ctx, args) {
    var b = ctx.db.get('salonBookings', args.id); if (!b) return u.fail('予約が見つかりません。', 'gone');
    var st = args.status;
    if (st === '来店済み') { ctx.db.update('salonBookings', b.id, { status: '来店済み', visitedAt: u.stamp(ctx.now().ts) }); }
    else if (st === '無断キャンセル') ctx.db.update('salonBookings', b.id, { status: '無断キャンセル' });
    else if (st === '取り消し（店）' || st === '取り消し（お客様）') {
      ctx.db.update('salonBookings', b.id, { status: st, cancelReason: args.reason || (st === '取り消し（店）' ? '店の都合' : 'お客様から電話') });
      if (args.notify) N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '取り消し', template: 'salon_cancelled', refId: b.id, mode: 'push', vars: B.salonVars(ctx, b) });
    } else if (st === 'move') {
      var m = B.menu(ctx, b.menuId), s = B.slotState(ctx, args.date, +args.start, m, { asShop: true, ignoreId: b.id });
      if (!s.ok) return u.fail(s.why, 'slot');
      var free = B.freeSeats(ctx, args.date, +args.start, m.hold, b.id);
      ctx.db.update('salonBookings', b.id, { date: args.date, start: +args.start, end: +args.start + m.mins, holdUntil: +args.start + m.hold, seatIds: free.slice(0, m.seats), reminded: false });
      if (args.notify) N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '変更', template: 'salon_changed', refId: b.id, mode: 'push', vars: B.salonVars(ctx, ctx.db.get('salonBookings', b.id)) });
    } else if (st === 'note') ctx.db.update('salonBookings', b.id, { note: String(args.note || '') });
    else return u.fail('できない操作です。', 'state');
    c.audit(ctx, 'サロンの予約：' + (st === 'move' ? '日時を変更' : st), b.id);
    return { ok: true, booking: salonRow(ctx, ctx.db.get('salonBookings', b.id)) };
  }
  /* 1件のサロン予約（取り消し済みも開ける）。記録と送ったお知らせも返す */
  function salonOne(ctx, args) {
    var b = ctx.db.get('salonBookings', args.id); if (!b) return u.fail('予約が見つかりません。', 'gone');
    return { ok: true, booking: salonRow(ctx, b), history: ctx.db.all('audit').filter(function (a) { return String(a.target).indexOf(b.id) === 0; }), notices: ctx.db.all('notices').filter(function (n) { return n.refId === b.id; }) };
  }
  function blockAdd(ctx, args) {
    var start = +args.start, end = +args.end;
    if (!args.date || !(end > start)) return u.fail('日付と時間を選んでください。', 'input');
    var b = ctx.db.insert('salonBlocks', { id: ctx.db.nextId('K'), date: args.date, start: start, end: end, seatIds: args.seatIds && args.seatIds.length ? args.seatIds : c.cfg(ctx).salon.seats.map(function (s) { return s.id; }), reason: args.reason || '店の用事' });
    c.audit(ctx, '席を押さえた', args.date + ' ' + u.hm(start) + '〜' + u.hm(end));
    return { ok: true, block: b };
  }
  function blockRemove(ctx, args) { ctx.db.remove('salonBlocks', args.id); c.audit(ctx, '席の押さえを外した', args.id); return { ok: true }; }
  function measureSet(ctx, args) {
    var b = ctx.db.get('measureBookings', args.id); if (!b) return u.fail('予約が見つかりません。', 'gone');
    ctx.db.update('measureBookings', b.id, { status: args.status, cancelReason: args.reason || '' });
    c.audit(ctx, '採寸の予約：' + args.status, b.id);
    return { ok: true };
  }

  /* S04 取り置き・注文 */
  function orders(ctx, args) {
    var f = (args && args.filter) || '進行中';
    var list = ctx.db.all('orders').filter(function (o) {
      if (f === '進行中') return o.status === '受付' || o.status === '用意済み' || o.status === '支払い待ち';
      if (f === 'すべて') return true;
      return o.status === f;
    }).map(function (o) { return orderRow(ctx, o); }).reverse();
    var counts = {};
    ctx.db.all('orders').forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });
    return { ok: true, filter: f, rows: list, counts: counts };
  }
  function order(ctx, args) {
    var o = ctx.db.get('orders', args.id); if (!o) return u.fail('見つかりません。', 'gone');
    return { ok: true, order: orderRow(ctx, o), history: ctx.db.all('audit').filter(function (a) { return String(a.target).indexOf(o.id) === 0; }), notices: ctx.db.all('notices').filter(function (n) { return n.refId === o.id; }) };
  }
  function orderSet(ctx, args) {
    var o = ctx.db.get('orders', args.id); if (!o) return u.fail('見つかりません。', 'gone');
    var st = args.status, now = ctx.now(), cust = ctx.db.get('customers', o.customerId);
    if (st === '用意済み') { if (o.status !== '受付') return u.fail('受付のものだけ用意済みにできます。', 'state'); ctx.db.update('orders', o.id, { status: '用意済み' }); }
    else if (st === '受け取り済み') ctx.db.update('orders', o.id, { status: '受け取り済み', doneAt: u.stamp(now.ts) });
    else if (st === '発送済み') {
      ctx.db.update('orders', o.id, { status: '発送済み', doneAt: u.stamp(now.ts), ship: Object.assign({}, o.ship || {}, { tracking: String(args.tracking || '') }) });
      N.send(ctx, cust, { kind: '発送', template: 'order_shipped', refId: o.id, mode: 'push', subject: '発送しました', vars: { 番号: o.id, 配送: o.ship ? o.ship.method : '', 追跡: args.tracking ? '問い合わせ番号 ' + args.tracking : '' } });
    } else if (st === '取り消し') {
      if (o.status === '取り消し' || o.status === '受け取り済み' || o.status === '発送済み') return u.fail('この注文は取り消せません。', 'state');
      ctx.db.update('orders', o.id, { status: '取り消し', cancelReason: args.reason || '店で取り消し', payStatus: o.payStatus === '支払い済み' ? '返金待ち' : o.payStatus });
      G.cancelPayLink(ctx, o);
      G.restore(ctx, o, '店で取り消し');
      if (args.notify) N.send(ctx, cust, { kind: '取り消し', template: 'order_cancelled', refId: o.id, mode: 'push', vars: { 番号: o.id, 理由: args.reason || '' } });
    } else if (st === '返金済み') {
      /* 台帳だけ「返金済み」にしないよう、Squareで返金が済んだことを確かめてから記録する（返金そのものはSquareの画面で行う） */
      if (o.payStatus !== '返金待ち') return u.fail('返金待ちの注文だけ返金済みにできます。', 'state');
      var rs = o.payRef && ctx.out.pay.refundStatus ? ctx.out.pay.refundStatus(o.payRef, o.total) : 'unknown';
      if (rs !== 'refunded') return u.fail(rs === 'pending' ? 'Squareで返金の手続き中です。済んでからもう一度押してください。' : rs === 'partial' ? 'Squareでの返金が一部だけです。全額を返金してから押してください。' : 'Squareで返金が済んだことを確かめられませんでした。先にSquareの画面で返金してください。', 'refund');
      ctx.db.update('orders', o.id, { payStatus: '返金済み', refundedAt: u.stamp(ctx.now().ts) });
    }
    else if (st === 'note') ctx.db.update('orders', o.id, { note: String(args.note || '') });
    else if (st === 'pickupDate') ctx.db.update('orders', o.id, { pickupDate: args.date, remindedDayBefore: false, noShowNotified: false });
    else return u.fail('できない操作です。', 'state');
    c.audit(ctx, '取り置き：' + st, o.id);
    return { ok: true, order: orderRow(ctx, ctx.db.get('orders', o.id)) };
  }

  /* S05 在庫と入荷 */
  function stock(ctx, args) {
    var sid = args && args.schoolId;
    var ps = ctx.db.all('products').filter(function (p) { return !p.needsMeasure && (!sid || p.schoolId === sid || (sid === 'common' && !p.schoolId)); }).sort(u.by('sort'));
    var rows = ps.map(function (p) {
      return {
        product: p, school: p.schoolId ? (c.school(ctx, p.schoolId) || {}).short : '共通', price: c.priceRange(p),
        sizes: p.sizes.map(function (z) {
          var held = u.sum(G.liveHolds(ctx).filter(function (h) { return h.productId === p.id && h.size === z; }), function (h) { return h.qty; });
          return { size: z, label: c.sizeLabel(p, z), price: c.priceOf(p, z), qty: G.qtyOf(ctx, p.id, z), held: held, free: G.freeQty(ctx, p.id, z), waiting: G.waitingFor(ctx, p.id, z).length, mark: G.mark(ctx, G.freeQty(ctx, p.id, z)) };
        })
      };
    });
    return { ok: true, rows: rows, schools: ctx.db.all('schools').sort(u.by('sort')), quota: N.quota(ctx) };
  }
  /* 数を直す（棚卸し）。お知らせは送らない */
  function stockSet(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p || p.sizes.indexOf(args.size) < 0) return u.fail('品物とサイズを選んでください。', 'input');
    var q = Math.max(0, Math.floor(+args.qty || 0)), sid = G.stockId(p.id, args.size), now = ctx.now();
    var row = { qty: q, updatedAt: u.stamp(now.ts), updatedBy: c.memberName(ctx, ctx.user.shopEmail || '') + '（数を直した）' };
    if (ctx.db.get('stock', sid)) ctx.db.update('stock', sid, row); else { row.id = sid; row.productId = p.id; row.size = args.size; ctx.db.insert('stock', row); }
    c.audit(ctx, '在庫の数を直した', c.productLabel(ctx, p.id, args.size) + ' → ' + q);
    return { ok: true };
  }
  /* 入荷を入れる前の確認：「待っている人 ○人／今回知らせる ○人／今月の残り通数 ○通」 */
  function restockPreview(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p) return u.fail('品物を選んでください。', 'input');
    var add = Math.max(0, Math.floor(+args.qty || 0));
    var free = G.freeQty(ctx, p.id, args.size) + add;
    var waiting = G.waitingFor(ctx, p.id, args.size);
    var lineCount = waiting.slice(0, free).filter(function (w) { var x = ctx.db.get('customers', w.customerId); return x && x.lineUserId && !x.blocked; }).length;
    var notify = Math.min(free, waiting.length);
    return { ok: true, label: c.productLabel(ctx, p.id, args.size), add: add, freeAfter: free, waiting: waiting.length, willNotify: notify, lineCount: lineCount, mailCount: notify - lineCount, quota: N.quota(ctx) };
  }
  function restockSend(ctx, args) {
    var pv = restockPreview(ctx, args); if (!pv.ok) return pv;
    var p = c.product(ctx, args.productId), sid = G.stockId(p.id, args.size), now = ctx.now(), st = ctx.db.get('stock', sid);
    if (pv.add > 0) {
      var row = { qty: (st ? +st.qty : 0) + pv.add, updatedAt: u.stamp(now.ts), updatedBy: c.memberName(ctx, ctx.user.shopEmail || '') + '（入荷 +' + pv.add + '）' };
      if (st) ctx.db.update('stock', sid, row); else { row.id = sid; row.productId = p.id; row.size = args.size; ctx.db.insert('stock', row); }
    }
    var r = args.notify === false ? { sent: [], skipped: [] } : G.notifyWaiters(ctx, p.id, args.size, pv.freeAfter);
    c.audit(ctx, '入荷を入れた', pv.label + ' +' + pv.add + '（お知らせ ' + r.sent.length + '人）');
    return { ok: true, added: pv.add, sent: r.sent.length, skipped: r.skipped.length, quota: N.quota(ctx) };
  }
  function waits(ctx, args) {
    var list = ctx.db.all('waits').filter(function (w) { return !args || !args.productId || w.productId === args.productId; }).map(function (w) {
      var v = G.waitView(ctx, w); v.customer = custBrief(ctx, w.customerId); v.notifiedAt = w.notifiedAt; v.endReason = w.endReason || ''; return v;
    }).reverse();
    return { ok: true, rows: list };
  }

  /* S06 お客様台帳 */
  function customers(ctx, args) {
    var q = String((args && args.q) || '').trim(), qp = u.normPhone(q), qk = u.normKana(q);
    var all = ctx.db.all('customers').filter(function (x) { return !x.mergedInto; });
    var list = all.filter(function (x) {
      if (!q) return true;
      return (x.name && x.name.indexOf(q) >= 0) || (x.lineName && x.lineName.indexOf(q) >= 0) || (qk && x.kana && x.kana.indexOf(qk) >= 0) || (qp.length >= 3 && x.phone && x.phone.indexOf(qp) >= 0) || (x.email && x.email.indexOf(q.toLowerCase()) >= 0);
    }).map(function (x) {
      var o = ctx.db.all('orders').filter(function (r) { return r.customerId === x.id; });
      var s = ctx.db.all('salonBookings').filter(function (r) { return r.customerId === x.id; });
      var last = [].concat(o.map(function (r) { return r.createdDate; }), s.map(function (r) { return r.date; })).sort().pop() || '';
      return { id: x.id, name: c.nameOf(x), kana: x.kana, phone: x.phone, email: x.email, line: !!x.lineUserId, blocked: !!x.blocked, school: x.schoolId ? (c.school(ctx, x.schoolId) || {}).short : '', firstSource: x.firstSource, heardFrom: x.heardFrom, orders: o.length, salon: s.filter(function (r) { return r.status === '来店済み'; }).length, last: last, createdAt: x.createdAt, memo: x.memo };
    }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });
    return { ok: true, rows: list.slice(0, 300), total: all.length };
  }
  function customer(ctx, args) {
    var x = ctx.db.get('customers', args.id); if (!x) return u.fail('見つかりません。', 'gone');
    var mine = function (t) { return ctx.db.all(t).filter(function (r) { return r.customerId === x.id; }); };
    return {
      ok: true, customer: x,
      orders: mine('orders').map(function (o) { return orderRow(ctx, o); }).reverse(),
      salon: mine('salonBookings').map(function (b) { return salonRow(ctx, b); }).reverse(),
      measure: mine('measureBookings').map(function (b) { return measureRow(ctx, b); }).reverse(),
      waits: mine('waits').map(function (w) { return G.waitView(ctx, w); }).reverse(),
      notices: mine('notices').slice(-30).reverse(), reviews: mine('reviews').reverse()
    };
  }
  function customerSet(ctx, args) {
    var x = ctx.db.get('customers', args.id); if (!x) return u.fail('見つかりません。', 'gone');
    var p = {};
    ['name', 'memo'].forEach(function (k) { if (args[k] != null) p[k] = String(args[k]); });
    if (args.phone != null) p.phone = u.normPhone(args.phone);
    if (args.kana != null) p.kana = u.normKana(args.kana);
    if (args.mergeInto) {
      var to = ctx.db.get('customers', args.mergeInto); if (!to || to.id === x.id) return u.fail('まとめる先が見つかりません。', 'input');
      ['orders', 'salonBookings', 'measureBookings', 'waits', 'notices', 'reviews'].forEach(function (t) { ctx.db.all(t).filter(function (r) { return r.customerId === x.id; }).forEach(function (r) { ctx.db.update(t, r.id, { customerId: to.id }); }); });
      if (x.lineUserId && !to.lineUserId) ctx.db.update('customers', to.id, { lineUserId: x.lineUserId, lineName: x.lineName });
      p.mergedInto = to.id; p.lineUserId = '';
    }
    ctx.db.update('customers', x.id, p);
    c.audit(ctx, args.mergeInto ? '同じ方としてまとめた' : 'お客様の情報を直した', x.id + (args.mergeInto ? ' → ' + args.mergeInto : ''));
    return { ok: true };
  }

  /* S07 お知らせの記録 */
  function notices(ctx, args) { return N.log(ctx, args); }

  /* S08 設定 */
  function settingsGet(ctx) {
    var cf = c.cfg(ctx);
    return {
      ok: true, cfg: cf, schools: ctx.db.all('schools').sort(u.by('sort')), products: ctx.db.all('products').sort(u.by('sort')),
      menus: B.menus(ctx, true), holidays: ctx.db.all('holidays').sort(u.by('date')),
      measureSlots: ctx.db.all('measureSlots').sort(u.by('date')).map(function (s) { var r = u.clone(s); r.used = B.slotUsed(ctx, s.id); return r; }),
      role: ctx.user.role
    };
  }
  var CFG_LABEL = { shop: '店の情報', openDays: '営業日', open: '開店の時刻', close: '閉店の時刻', stages: 'お客様に見せるもの', cart: 'かごの決まり', pickup: '受け取りの決まり', restock: '入荷のお知らせの決まり', payment: '支払いの決まり', ship: '送り方と送料', salon: 'サロンの決まり', line: 'LINEの通数の決まり', voice: '声の決まり', campaign: 'お買い上げプレゼントの案内', templates: 'お知らせの文', legal: '決まり（特商法・プライバシー・キャンセル）', shopMembers: '店の人の名簿', sampleData: '見本のデータ' };
  var TABLE_LABEL = { schools: '学校', products: '品物', salonMenus: 'サロンのメニュー', holidays: '臨時休業', measureSlots: '採寸の枠' };
  var CFG_KEYS = ['shop', 'openDays', 'open', 'close', 'stages', 'cart', 'pickup', 'restock', 'payment', 'ship', 'salon', 'line', 'voice', 'campaign', 'templates', 'legal', 'shopMembers', 'sampleData'];
  function settingsSave(ctx, args) {
    var k = args.key;
    if (CFG_KEYS.indexOf(k) < 0) return u.fail('変えられない項目です。', 'input');
    if (k === 'shopMembers' && ctx.user.role !== 'admin' && ctx.user.role !== 'owner') return u.fail('この項目は変えられません。', 'auth');
    c.setCfg(ctx, k, args.value);
    c.audit(ctx, '設定を変えた', CFG_LABEL[k] || k);
    return { ok: true };
  }
  /* 「120:4500, 130:4800」を {120: 4500, 130: 4800} にする。空なら null。num は値を数にする */
  function sizeMap(v, num) {
    if (v === undefined || v === null || v === '') return { map: null };
    if (typeof v === 'object') v = Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join(',');
    var out = {}, bad = [];
    String(v).split(/[、,，\n]+/).forEach(function (x) {
      x = x.trim(); if (!x) return;
      var m = /^([^:：]+)[:：](.+)$/.exec(x);
      if (!m) { bad.push(x); return; }
      var k = m[1].trim(), val = m[2].trim();
      if (num) { val = +String(val).replace(/[円,，\s]/g, ''); if (!(val > 0)) { bad.push(x); return; } }
      out[k] = val;
    });
    if (bad.length) return { error: (num ? 'サイズごとの価格' : 'サイズの表示名') + 'の書き方を確かめてください（「120:4500, 130:4800」のように）：' + bad.join('、') };
    return { map: Object.keys(out).length ? out : null };
  }
  /* 表の1行を足す・直す・消す（学校・品物・メニュー・休み・採寸の枠） */
  var EDIT = { schools: 'S', products: 'P', salonMenus: 'M', holidays: '', measureSlots: 'J' };
  function rowSave(ctx, args) {
    var t = args.table; if (!(t in EDIT)) return u.fail('変えられない表です。', 'input');
    var r = args.row || {}, key = KS.core.model.TABLES[t];
    if (t === 'products') {
      if (!String(r.name || '').trim()) return u.fail('品名を入れてください。', 'input');
      if (typeof r.sizes === 'string') r.sizes = r.sizes.split(/[、,\s]+/).filter(Boolean);
      r.price = +r.price || 0;
      /* サイズごとの価格・表示名：「120:4500, 130:4800」の1行でも、{サイズ: 値} でも受け取る */
      var sp = sizeMap(r.sizePrices, true), sl = sizeMap(r.sizeLabels, false);
      if (sp.error || sl.error) return u.fail(sp.error || sl.error, 'input');
      var sizes = r.sizes || (r.id && ctx.db.get('products', r.id) || {}).sizes || [];
      var stray = Object.keys(sp.map || {}).concat(Object.keys(sl.map || {})).filter(function (z) { return sizes.indexOf(z) < 0; });
      if (stray.length) return u.fail('サイズの一覧に無いサイズがあります：' + stray.join('、') + '。サイズの欄に足すか、書き方を直してください。', 'input');
      if ('sizePrices' in r) r.sizePrices = sp.map;
      if ('sizeLabels' in r) r.sizeLabels = sl.map;
      /* 価格の欄が空なら、サイズの価格のいちばん安いものを入れておく（サイズの価格が無いサイズに使う） */
      if (!r.price && sp.map) r.price = Math.min.apply(null, Object.keys(sp.map).map(function (z) { return sp.map[z]; }));
    }
    if (t === 'measureSlots') { r.start = +r.start; r.end = +r.end; r.capacity = Math.max(1, +r.capacity || 1); if (!r.schoolId || !r.date) return u.fail('学校と日付を選んでください。', 'input'); }
    if (t === 'salonMenus') { r.mins = +r.mins; r.hold = +r.hold || (+r.mins + 30); r.price = +r.price || 0; r.seats = +r.seats || 1; }
    if (r[key] && ctx.db.get(t, r[key])) ctx.db.update(t, r[key], r);
    else {
      if (!r[key]) r[key] = t === 'holidays' ? r.date : ctx.db.nextId(EDIT[t]);
      if (t === 'products') { r.visible = r.visible !== false; r.sort = r.sort || ctx.db.all('products').length + 1; r.required = r.required !== false; }
      ctx.db.insert(t, r);
    }
    c.audit(ctx, TABLE_LABEL[t] + 'を直した', r[key] + (r.name ? '（' + r.name + '）' : ''));
    return { ok: true, row: ctx.db.get(t, r[key]) };
  }
  function rowRemove(ctx, args) {
    var t = args.table; if (!(t in EDIT)) return u.fail('変えられない表です。', 'input');
    if (t === 'measureSlots' && B.slotUsed(ctx, args.key) > 0) return u.fail('予約が入っている枠は消せません。先に予約を取り消してください。', 'state');
    if (t === 'products' || t === 'schools' || t === 'salonMenus') { ctx.db.update(t, args.key, { visible: false }); c.audit(ctx, TABLE_LABEL[t] + 'の表示をやめた', args.key); return { ok: true, hidden: true }; }
    ctx.db.remove(t, args.key);
    c.audit(ctx, TABLE_LABEL[t] + 'を消した', args.key);
    return { ok: true };
  }
  function auditLog(ctx) { return { ok: true, rows: ctx.db.all('audit').slice(-300).reverse() }; }

  return {
    today: today, calendar: calendar, salonCreate: salonCreate, salonWeekShop: salonWeekShop, salonSet: salonSet, salonOne: salonOne, blockAdd: blockAdd, blockRemove: blockRemove,
    measureSet: measureSet, orders: orders, order: order, orderSet: orderSet, stock: stock, stockSet: stockSet, restockPreview: restockPreview, restockSend: restockSend,
    waits: waits, customers: customers, customer: customer, customerSet: customerSet, notices: notices, settingsGet: settingsGet, settingsSave: settingsSave,
    rowSave: rowSave, rowRemove: rowRemove, auditLog: auditLog
  };
})();
