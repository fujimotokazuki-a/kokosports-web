/* ココスポーツ 本番：体操服・制服（F1 取り置き／F2 入荷のお知らせ／F4 配送と事前決済）
   在庫の考え方
   - stock.qty は店にある数。取り置き（注文）を受けたら減らし、取り消したら戻す
   - かごに入れた分（holds の「押さえ中」）と、入荷のお知らせで優先している分（「優先」）は、qty から引いて「残り」を出す
   - お客様には数を出さない：あり／残りわずか（2以下）／品切れ */
KS.core.goods = (function () {
  var u = KS.core.u, c = KS.core.c, N = KS.core.notify;

  function stockId(pid, size) { return pid + '|' + size; }
  function qtyOf(ctx, pid, size) { var s = ctx.db.get('stock', stockId(pid, size)); return s ? (+s.qty || 0) : 0; }
  function liveHolds(ctx) {
    var ts = ctx.now().ts;
    return ctx.db.all('holds').filter(function (h) { return (h.status === '押さえ中' || h.status === '優先') && h.expiresAt > ts; });
  }
  /* 残り（ほかの人が取れる数）。exceptKey のかご・優先は自分の分なので引かない */
  function freeQty(ctx, pid, size, exceptKey) {
    var held = u.sum(liveHolds(ctx).filter(function (h) { return h.productId === pid && h.size === size && h.ownerKey !== exceptKey; }), function (h) { return h.qty; });
    return Math.max(0, qtyOf(ctx, pid, size) - held);
  }
  function mark(ctx, n) { return n <= 0 ? '品切れ' : (n <= c.cfg(ctx).cart.lowStock ? '残りわずか' : 'あり'); }

  /* かごの持ち主：LINEの人はお客様ID、外の人はかごのID */
  function ownerKey(ctx, cartId) { var me = c.meLine(ctx); return me ? me.id : 'cart:' + cartId; }

  /* --- C10 学校を選ぶ --- */
  function schools(ctx) {
    var me = c.meLine(ctx);
    var list = ctx.db.all('schools').filter(function (s) { return s.visible !== false; }).sort(u.by('sort'));
    return { ok: true, schools: list, lastSchoolId: me ? me.schoolId : '' };
  }

  /* --- C11 学校の品物 --- */
  function schoolItems(ctx, args) {
    var s = c.school(ctx, args.schoolId); if (!s || s.visible === false) return u.fail('学校が見つかりません。', 'notfound');
    var me = c.meLine(ctx);
    if (me && me.schoolId !== s.id) ctx.db.update('customers', me.id, { schoolId: s.id });
    var items = ctx.db.all('products').filter(function (p) { return p.visible && (p.schoolId === s.id || (p.schoolId === '' && (!p.forKind || p.forKind === s.kind))); })
      .sort(u.by('sort')).map(function (p) { return summary(ctx, p); });
    return { ok: true, school: s, items: items, measureOpen: !!c.cfg(ctx).stages.measure && s.measure, campaign: campaignFor(ctx, s.id), orderOpen: orderOpen(ctx) };
  }
  /* 体操服のお買い上げプレゼントの案内（設定 campaign）。有効で、その学校が対象のときだけ */
  function campaignFor(ctx, schoolId) {
    var cp = c.cfg(ctx).campaign;
    if (!cp || !cp.on || !String(cp.text || '').trim()) return null;
    if (cp.schoolIds && cp.schoolIds.length && cp.schoolIds.indexOf(schoolId) < 0) return null;
    return { title: cp.title || '', text: cp.text };
  }
  /* 取り置きを始めているか。始める前（料金表だけ）は、在庫のありなしも出さない */
  function orderOpen(ctx) { return !!c.cfg(ctx).stages.order; }
  function summary(ctx, p) {
    var open = orderOpen(ctx);
    var marks = p.sizes.map(function (z) { return open ? mark(ctx, freeQty(ctx, p.id, z)) : ''; });
    var any = marks.some(function (m) { return m !== '品切れ'; }), pr = c.priceRange(p);
    /* price は最低価格。priceFrom が true なら「2,300円〜」と出す */
    return {
      id: p.id, cat: p.cat, name: p.name, price: pr.min, priceMax: pr.max, priceFrom: pr.varies, priceTentative: !!p.priceTentative, needsMeasure: !!p.needsMeasure,
      required: p.required, photo: p.photo, note: p.note, state: p.needsMeasure ? '採寸' : !open ? '' : (any ? (marks.indexOf('あり') >= 0 ? 'あり' : '残りわずか') : '品切れ')
    };
  }

  /* --- C12 品物とサイズ --- */
  function item(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p || !p.visible) return u.fail('この品物は今は扱っていません。', 'notfound');
    var me = c.meLine(ctx), key = ownerKey(ctx, args.cartId || ''), open = orderOpen(ctx);
    var myWaits = me && open ? ctx.db.all('waits').filter(function (w) { return w.customerId === me.id && w.productId === p.id && (w.status === '待ち' || w.status === 'お知らせ済み'); }) : [];
    var sizes = p.sizes.map(function (z) {
      var mine = myWaits.filter(function (w) { return w.size === z; })[0];
      return { size: z, label: c.sizeLabel(p, z), price: c.priceOf(p, z), state: open ? mark(ctx, freeQty(ctx, p.id, z, key)) : '', waiting: !!mine, waitStatus: mine ? mine.status : '' };
    });
    var pr = c.priceRange(p);
    return { ok: true, product: p, school: p.schoolId ? c.school(ctx, p.schoolId) : null, sizes: sizes, priceMin: pr.min, priceMax: pr.max, priceFrom: pr.varies, orderOpen: open };
  }

  /* --- C13 かご（30分だけ在庫を押さえる） --- */
  function cart(ctx, args) {
    var key = ownerKey(ctx, args.cartId || ''), ts = ctx.now().ts;
    var hs = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中'; });
    var expired = [];
    hs.forEach(function (h) { if (h.expiresAt <= ts) ctx.db.update('holds', h.id, { status: '期限切れ' }); });
    /* 期限切れになって、まだお客様に見せていない分（5分ごとの処理が先に切ることがあるため） */
    ctx.db.all('holds').forEach(function (h) {
      if (h.ownerKey === key && h.status === '期限切れ' && !h.seen && ts - h.expiresAt < 86400000) { ctx.db.update('holds', h.id, { seen: true }); expired.push(c.productLabel(ctx, h.productId, h.size)); }
    });
    var lines = hs.filter(function (h) { return h.expiresAt > ts; }).map(function (h) {
      var p = c.product(ctx, h.productId);
      return { holdId: h.id, productId: h.productId, size: h.size, qty: h.qty, name: p ? p.name : '', label: c.productLabel(ctx, h.productId, h.size), price: c.priceOf(p, h.size), priceTentative: p ? !!p.priceTentative : false, expiresAt: h.expiresAt };
    });
    var minExp = lines.length ? Math.min.apply(null, lines.map(function (l) { return l.expiresAt; })) : 0;
    return { ok: true, lines: lines, goods: u.sum(lines, function (l) { return l.price * l.qty; }), count: u.sum(lines, function (l) { return l.qty; }), expiresAt: minExp, expired: expired, now: ts };
  }
  function cartAdd(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p) return u.fail('品物が見つかりません。', 'notfound');
    if (p.needsMeasure) return u.fail('制服は採寸してからご用意します。採寸のご予約へお進みください。', 'measure');
    if (p.sizes.indexOf(args.size) < 0) return u.fail('サイズを選んでください。', 'size');
    var qty = Math.max(1, Math.min(9, +args.qty || 1)), key = ownerKey(ctx, args.cartId || ''), now = ctx.now();
    var hold = c.cfg(ctx).cart.holdMin * 60000;
    /* 入荷のお知らせで自分に優先が付いていれば、それをかごに移す */
    var pri = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '優先' && h.productId === p.id && h.size === args.size && h.expiresAt > now.ts; })[0];
    if (pri) {
      ctx.db.update('holds', pri.id, { status: '押さえ中', expiresAt: now.ts + hold, qty: Math.max(pri.qty, 1) });
      qty = Math.max(0, qty - pri.qty);
      if (!qty) return cart(ctx, args);
    }
    var free = freeQty(ctx, p.id, args.size, key) - u.sum(ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中' && h.productId === p.id && h.size === args.size && h.expiresAt > now.ts; }), function (h) { return h.qty; });
    if (free < qty) return u.fail(free > 0 ? 'このサイズは残り少なく、' + qty + '点はご用意できません。数を減らしてください。' : 'このサイズはたった今品切れになりました。入荷のお知らせに登録できます。', 'soldout', { free: free });
    var same = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中' && h.productId === p.id && h.size === args.size && h.expiresAt > now.ts; })[0];
    if (same) ctx.db.update('holds', same.id, { qty: same.qty + qty, expiresAt: now.ts + hold });
    else ctx.db.insert('holds', { id: ctx.db.nextId('H'), ownerKey: key, productId: p.id, size: args.size, qty: qty, status: '押さえ中', expiresAt: now.ts + hold, createdAt: now.ts, waitId: pri ? pri.waitId : '' });
    return cart(ctx, args);
  }
  function cartSet(ctx, args) {
    var key = ownerKey(ctx, args.cartId || ''), h = ctx.db.get('holds', args.holdId);
    if (!h || h.ownerKey !== key) return cart(ctx, args);
    var q = +args.qty || 0;
    if (q <= 0) ctx.db.update('holds', h.id, { status: '外した' });
    else if (q > h.qty) {
      var free = freeQty(ctx, h.productId, h.size, key);
      var mineOther = 0;
      if (free - mineOther < q) return u.fail('この数はご用意できません。', 'soldout');
      ctx.db.update('holds', h.id, { qty: q });
    } else ctx.db.update('holds', h.id, { qty: q });
    return cart(ctx, args);
  }

  /* --- C14 受け取りの日（営業日だけ） --- */
  function pickupDays(ctx) {
    var cf = c.cfg(ctx), today = ctx.now().date, out = [];
    for (var i = cf.pickup.fromDays; i <= cf.pickup.toDays; i++) {
      var d = u.addDays(today, i);
      out.push({ date: d, open: c.isOpen(ctx, d), why: c.isOpen(ctx, d) ? '' : (c.holidayReason(ctx, d) || '定休日') });
    }
    return out;
  }
  function checkoutInfo(ctx, args) {
    var me = c.meLine(ctx), cf = c.cfg(ctx), cr = cart(ctx, args);
    return {
      ok: true, cart: cr, days: pickupDays(ctx), ship: cf.stages.ship ? cf.ship : null, prepay: !!cf.stages.prepay,
      profile: me ? { name: me.name, kana: me.kana, phone: me.phone, email: me.email, inLine: true } : { inLine: false },
      legal: cf.legal, shop: cf.shop, keepDays: cf.pickup.keepDays, payDeadlineMin: cf.payment.deadlineMin
    };
  }
  function shipFee(ctx, methodId, count) {
    var m = c.cfg(ctx).ship.methods.filter(function (x) { return x.id === methodId; })[0];
    if (!m) return null;
    if (count > m.maxItems) return { error: 'この送り方は' + m.maxItems + '点までです。' };
    return { method: m, fee: m.fee };
  }

  /* --- C15 最後の確認 → 注文（取り置き）を作る --- */
  function validateOrder(ctx, f, inLine) {
    var e = {};
    if (!String(f.name || '').trim()) e.name = 'お名前を入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!inLine && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。確認のお知らせをお送りします。';
    if (f.method === '配送') {
      if (!u.okZip(f.zip)) e.zip = '郵便番号を7桁で入力してください。';
      if (!String(f.addr || '').trim()) e.addr = '住所を入力してください。';
      if (!f.shipMethod) e.shipMethod = '送り方を選んでください。';
    } else if (!f.pickupDate) e.pickupDate = '受け取りの日を選んでください。';
    if (!f.agree) e.agree = '内容と決まりをご確認のうえ、チェックを入れてください。';
    return e;
  }
  function placeOrder(ctx, args) {
    var cf = c.cfg(ctx), f = args.form || {}, me = c.meLine(ctx), now = ctx.now();
    if (!cf.stages.order) return u.fail('ただいま準備中です。お電話でお問い合わせください。', 'closed');
    if (f.method === '配送' && !cf.stages.ship) return u.fail('配送はまだ準備中です。', 'closed');
    var errs = validateOrder(ctx, f, !!me);
    if (Object.keys(errs).length) return u.fail('入力を確かめてください。', 'input', { errors: errs });
    if (f.method !== '配送') {
      var d = pickupDays(ctx).filter(function (x) { return x.date === f.pickupDate; })[0];
      if (!d || !d.open) return u.fail('その日はお休みです。ほかの日を選んでください。', 'input', { errors: { pickupDate: 'その日はお休みです。' } });
    }
    var key = ownerKey(ctx, args.cartId || '');
    var hs = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中'; });
    if (!hs.length) return u.fail('かごが空です。品物を選び直してください。', 'empty');
    /* かごの期限が切れていたら、取り直せるか確かめる（同時に取られていれば C13 に戻す） */
    var lost = [];
    hs.forEach(function (h) {
      if (h.expiresAt > now.ts) return;
      if (freeQty(ctx, h.productId, h.size, key) >= h.qty) ctx.db.update('holds', h.id, { expiresAt: now.ts + cf.cart.holdMin * 60000 });
      else { ctx.db.update('holds', h.id, { status: '期限切れ' }); lost.push(c.productLabel(ctx, h.productId, h.size)); }
    });
    if (lost.length) return u.fail('確保できなかった品があります：' + lost.join('、') + '。かごを確かめてください。', 'lost', { lost: lost });
    hs = hs.filter(function (h) { return ctx.db.get('holds', h.id).status === '押さえ中'; });
    var count = u.sum(hs, function (h) { return h.qty; });
    var ship = null;
    if (f.method === '配送') {
      var sf = shipFee(ctx, f.shipMethod, count);
      if (!sf || sf.error) return u.fail(sf ? sf.error : '送り方を選んでください。', 'input', { errors: { shipMethod: sf ? sf.error : '送り方を選んでください。' } });
      ship = { methodId: sf.method.id, method: sf.method.name, fee: sf.fee, zip: u.normPhone(f.zip), addr: String(f.addr).trim(), to: String(f.shipName || f.name).trim(), tracking: '' };
    }
    var cust = c.resolveCustomer(ctx, { name: f.name, kana: f.kana, phone: f.phone, email: f.email, heardFrom: f.heardFrom, schoolId: f.schoolId }, me ? 'LINE' : (args.utm && args.utm.source) || 'Web');
    var lines = hs.map(function (h) {
      var p = c.product(ctx, h.productId);
      return { productId: h.productId, size: h.size, qty: h.qty, price: c.priceOf(p, h.size), name: p.name, label: c.productLabel(ctx, h.productId, h.size), waitId: h.waitId || '' };
    });
    var goods = u.sum(lines, function (l) { return l.price * l.qty; });
    var prepay = f.method === '配送' || (f.pay === '事前' && cf.stages.prepay);
    var o = {
      id: ctx.db.nextId('T'), token: u.token(), customerId: cust.id, lines: lines, method: f.method === '配送' ? '配送' : '店頭',
      pickupDate: f.method === '配送' ? '' : f.pickupDate, ship: ship, pay: prepay ? '事前' : '店頭',
      payStatus: prepay ? '支払い待ち' : '店頭で', payRef: '', payUrl: '', payDeadline: prepay ? now.ts + cf.payment.deadlineMin * 60000 : 0,
      status: prepay ? '支払い待ち' : '受付', goods: goods, shipFee: ship ? ship.fee : 0, total: goods + (ship ? ship.fee : 0),
      contact: { name: String(f.name).trim(), phone: u.normPhone(f.phone), email: u.normEmail(f.email || '') },
      channel: me ? 'LINE' : 'Web', utm: args.utm || null, note: String(f.note || ''), createdAt: u.stamp(now.ts), createdDate: now.date,
      remindedDayBefore: false, noShowNotified: false, cancelReason: '', doneAt: '', legalVersion: cf.legal.version
    };
    ctx.db.insert('orders', o);
    /* 在庫を減らし、かごを「注文済み」に。入荷のお知らせから来た分は「予約済み」 */
    hs.forEach(function (h) {
      var sid = stockId(h.productId, h.size), st = ctx.db.get('stock', sid);
      ctx.db.update('stock', sid, { qty: Math.max(0, (st ? +st.qty : 0) - h.qty), updatedAt: u.stamp(now.ts), updatedBy: '取り置き ' + o.id });
      ctx.db.update('holds', h.id, { status: '注文済み', orderId: o.id });
      if (h.waitId) ctx.db.update('waits', h.waitId, { status: '予約済み' });
    });
    c.audit(ctx, '取り置きを受付', o.id + '（' + lines.length + '品・' + o.method + '）');
    if (prepay) {
      var pr = ctx.out.pay.create(o, { shopName: cf.shop.name, returnUrl: c.link(ctx, 'done/order/' + o.token) });
      if (!pr || !pr.ok) {
        ctx.db.update('orders', o.id, { status: '取り消し', payStatus: '取り消し', cancelReason: '支払いの画面を作れなかった' });
        restore(ctx, o, '支払いの画面を作れなかった');
        return u.fail('支払いの画面を開けませんでした。時間をおいてもう一度、またはお電話でお願いします。', 'pay');
      }
      ctx.db.update('orders', o.id, { payRef: pr.ref, payUrl: pr.url });
      return { ok: true, order: view(ctx, ctx.db.get('orders', o.id)), payUrl: pr.url };
    }
    sendReceived(ctx, o, cust);
    return { ok: true, order: view(ctx, ctx.db.get('orders', o.id)) };
  }
  function sendReceived(ctx, o, cust) {
    N.send(ctx, cust || ctx.db.get('customers', o.customerId), {
      kind: '受付', template: 'order_received', refId: o.id, mode: 'reply', subject: '取り置きのご予約を受け付けました',
      vars: { 番号: o.id, 品物: linesText(o), 受け取り: receiveText(ctx, o), 支払い: payText(o), リンク: c.link(ctx, 'my/order/' + o.token) }
    });
  }
  function linesText(o) { return o.lines.map(function (l) { return '・' + l.label + ' ×' + l.qty; }).join('\n'); }
  function receiveText(ctx, o) { return o.method === '配送' ? '配送（' + (o.ship ? o.ship.method : '') + '）' : '店頭 ' + u.jpDate(o.pickupDate); }
  function payText(o) { return o.pay === '事前' ? (o.payStatus === '支払い済み' ? 'お支払い済み' : 'お支払い：ネットで事前') : 'お支払い：店頭'; }

  /* 在庫を戻す（取り消し・期限切れ） */
  function restore(ctx, o, why) {
    var now = ctx.now();
    o.lines.forEach(function (l) {
      var sid = stockId(l.productId, l.size), st = ctx.db.get('stock', sid);
      if (st) ctx.db.update('stock', sid, { qty: (+st.qty || 0) + l.qty, updatedAt: u.stamp(now.ts), updatedBy: '戻し ' + o.id + '（' + why + '）' });
    });
  }

  /* --- C16 支払いのあと（Squareから戻ってきたとき・定期の確認） --- */
  function checkPayment(ctx, o) {
    if (!o || o.payStatus !== '支払い待ち' || !o.payRef) return o;
    var st = ctx.out.pay.status(o.payRef);
    if (st === 'paid') {
      ctx.db.update('orders', o.id, { payStatus: '支払い済み', status: '受付', paidAt: u.stamp(ctx.now().ts) });
      o = ctx.db.get('orders', o.id);
      c.audit(ctx, '支払いを確認', o.id);
      sendReceived(ctx, o);
    } else if (st === 'canceled' || (st === 'open' && ctx.now().ts > o.payDeadline)) {
      expireUnpaid(ctx, o);
      o = ctx.db.get('orders', o.id);
    }
    return o;
  }
  function expireUnpaid(ctx, o) {
    if (o.status !== '支払い待ち') return;
    ctx.db.update('orders', o.id, { status: '取り消し', payStatus: '期限切れ', cancelReason: '支払いの期限（' + c.cfg(ctx).payment.deadlineMin + '分）が過ぎた' });
    cancelPayLink(ctx, o);
    restore(ctx, o, '未払い');
    c.audit(ctx, '未払いのため取り消し', o.id);
  }
  function orderDone(ctx, args) {
    var o = ctx.db.all('orders').filter(function (x) { return x.token === args.token; })[0];
    if (!o) return u.fail('この受付は見つかりません。', 'gone');
    o = checkPayment(ctx, o);
    if (o.status === '取り消し' && o.payStatus === '期限切れ') return u.fail('お支払いの期限が切れました。もう一度かごからお進みください。', 'expired');
    return { ok: true, order: view(ctx, o) };
  }
  /* 取り消したあとに払えてしまわないよう、支払いリンクを消す */
  function cancelPayLink(ctx, o) {
    if (o.payRef && o.payStatus !== '支払い済み' && ctx.out.pay.cancel) { try { ctx.out.pay.cancel(o.payRef); } catch (e) { } }
  }
  /* 試しの形だけ：Squareの画面の代わりに、払った／やめたを決める */
  function devPay(ctx, args) {
    var o = ctx.db.all('orders').filter(function (x) { return x.token === args.token; })[0];
    if (!o) return u.fail('見つかりません。', 'gone');
    if (ctx.out.pay.devSet) ctx.out.pay.devSet(o.payRef, args.paid ? 'paid' : 'canceled');
    return orderDone(ctx, { token: o.token });
  }

  /* 取り置きの期限：受け取り日＋7日。休みの日に当たったら次の営業日まで延ばす */
  function keepUntil(ctx, o) {
    if (!o.pickupDate) return '';
    var d = u.addDays(o.pickupDate, c.cfg(ctx).pickup.keepDays);
    for (var i = 0; i < 14 && !c.isOpen(ctx, d); i++) d = u.addDays(d, 1);
    return d;
  }
  /* お客様に見せる形 */
  function view(ctx, o) {
    var cf = c.cfg(ctx);
    return {
      id: o.id, token: o.token, kind: 'order', lines: o.lines, method: o.method, pickupDate: o.pickupDate, ship: o.ship, pay: o.pay, payStatus: o.payStatus,
      payUrl: o.payStatus === '支払い待ち' ? o.payUrl : '', payDeadline: o.payDeadline, status: o.status, goods: o.goods, shipFee: o.shipFee, total: o.total,
      createdAt: o.createdAt, cancelReason: o.cancelReason, keepUntil: keepUntil(ctx, o),
      canCancel: o.status === '受付' || o.status === '支払い待ち', mustCall: o.status === '用意済み', contact: o.contact
    };
  }

  /* --- C20 入荷のお知らせの登録 --- */
  function waitAdd(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p) return u.fail('品物が見つかりません。', 'notfound');
    if (p.sizes.indexOf(args.size) < 0) return u.fail('サイズを選んでください。', 'size');
    var me = c.meLine(ctx), now = ctx.now(), cust;
    if (me) cust = me;
    else {
      if (!u.okEmail(args.email)) return u.fail('お知らせを送るメールアドレスを入力してください。', 'input', { errors: { email: 'メールアドレスをご確認ください。' } });
      cust = c.resolveCustomer(ctx, { email: args.email, name: args.name || '' }, 'Web');
    }
    var dup = ctx.db.all('waits').filter(function (w) { return w.customerId === cust.id && w.productId === p.id && w.size === args.size && (w.status === '待ち' || w.status === 'お知らせ済み'); })[0];
    if (dup) return { ok: true, wait: waitView(ctx, dup), already: true };
    var w = ctx.db.insert('waits', {
      id: ctx.db.nextId('W'), token: u.token(), customerId: cust.id, schoolId: p.schoolId, productId: p.id, size: args.size,
      createdAt: u.stamp(now.ts), createdTs: now.ts, status: '待ち', notifiedAt: '', priorityUntil: 0, channel: me ? 'LINE' : 'メール'
    });
    c.audit(ctx, '入荷のお知らせに登録', w.id + '（' + c.productLabel(ctx, p.id, args.size) + '）');
    return { ok: true, wait: waitView(ctx, w) };
  }
  function waitView(ctx, w) {
    var p = c.product(ctx, w.productId);
    return { id: w.id, token: w.token, kind: 'wait', productId: w.productId, size: w.size, label: c.productLabel(ctx, w.productId, w.size), price: c.priceOf(p, w.size), status: w.status, createdAt: w.createdAt, priorityUntil: w.priorityUntil, channel: w.channel };
  }
  function waitCancel(ctx, args) {
    var w = findOwned(ctx, 'waits', args); if (!w) return u.fail('登録が見つかりません。', 'gone');
    ctx.db.update('waits', w.id, { status: '終了', endReason: 'お客様が取り消し' });
    releasePriority(ctx, w.id);
    return { ok: true };
  }

  /* --- C21 入荷のお知らせから開く --- */
  function restockOpen(ctx, args) {
    var w = ctx.db.all('waits').filter(function (x) { return x.token === args.token; })[0];
    if (!w) return u.fail('このお知らせは見つかりません。', 'gone');
    var p = c.product(ctx, w.productId), now = ctx.now(), owner = w.customerId;
    var me = c.meLine(ctx);
    var pri = ctx.db.all('holds').filter(function (h) { return h.waitId === w.id && h.status === '優先'; })[0];
    var inTime = w.status === 'お知らせ済み' && w.priorityUntil > now.ts;
    /* LINEの外の人（メールのリンク）は、かごのIDに優先を移す */
    if (inTime && pri && !me && args.cartId) ctx.db.update('holds', pri.id, { ownerKey: 'cart:' + args.cartId });
    var key = me ? me.id : 'cart:' + (args.cartId || '');
    return {
      ok: true, wait: waitView(ctx, w), inTime: inTime, mine: !me || me.id === owner, msLeft: inTime ? w.priorityUntil - now.ts : 0,
      product: p, size: w.size, sizeLabel: c.sizeLabel(p, w.size), price: c.priceOf(p, w.size), state: mark(ctx, freeQty(ctx, w.productId, w.size, key) + (inTime && pri ? 0 : 0))
    };
  }
  function releasePriority(ctx, waitId) {
    ctx.db.all('holds').filter(function (h) { return h.waitId === waitId && h.status === '優先'; }).forEach(function (h) { ctx.db.update('holds', h.id, { status: '外した' }); });
  }

  /* 入荷したとき：待っている人に、早い順に「取れる数」だけ知らせる（S05 と 24時間の繰り上げで使う） */
  function waitingFor(ctx, pid, size) {
    return ctx.db.all('waits').filter(function (w) { return w.productId === pid && w.size === size && w.status === '待ち'; }).sort(u.by('createdTs'));
  }
  function notifyWaiters(ctx, pid, size, maxCount) {
    var cf = c.cfg(ctx), now = ctx.now(), sent = [], skipped = [];
    var list = waitingFor(ctx, pid, size);
    for (var i = 0; i < list.length && sent.length < maxCount; i++) {
      var w = list[i], cust = ctx.db.get('customers', w.customerId);
      if (!cust || (cust.lineUserId && cust.blocked && !cust.email)) { ctx.db.update('waits', w.id, { status: '終了', endReason: 'ブロック' }); skipped.push(w.id); continue; }
      var until = now.ts + cf.restock.priorityHours * 3600000;
      ctx.db.update('waits', w.id, { status: 'お知らせ済み', notifiedAt: u.stamp(now.ts), priorityUntil: until });
      ctx.db.insert('holds', { id: ctx.db.nextId('H'), ownerKey: cust.id, productId: pid, size: size, qty: 1, status: '優先', expiresAt: until, createdAt: now.ts, waitId: w.id });
      var rec = N.send(ctx, cust, {
        kind: '入荷', template: 'restock', refId: w.id, mode: 'push', subject: '入荷のお知らせ',
        vars: { 品物: c.productLabel(ctx, pid), サイズ: c.sizeLabel(c.product(ctx, pid), size), 期限: u.stamp(until).slice(5).replace('-', '/') , リンク: c.link(ctx, 'restock/' + w.token) }
      });
      if (rec.status === '未送信') { ctx.db.update('waits', w.id, { status: '待ち', notifiedAt: '', priorityUntil: 0 }); releasePriority(ctx, w.id); skipped.push(w.id); if (rec.error && rec.error.indexOf('通数') >= 0) break; continue; }
      sent.push(w.id);
    }
    return { sent: sent, skipped: skipped };
  }

  /* 持ち主の確認：LINEの人は自分の行、外の人は鍵（token）で */
  function findOwned(ctx, table, args) {
    var row = args.token ? ctx.db.all(table).filter(function (x) { return x.token === args.token; })[0] : ctx.db.get(table, args.id);
    if (!row) return null;
    if (args.token && row.token === args.token) return row;
    var me = c.meLine(ctx);
    return me && row.customerId === me.id ? row : null;
  }

  /* お客様の取り消し（C41） */
  function orderCancel(ctx, args) {
    var o = findOwned(ctx, 'orders', args); if (!o) return u.fail('この受付は見つかりません。', 'gone');
    if (o.status === '用意済み') return u.fail('お店で用意が済んでいます。取り消しはお電話でお願いします。', 'call');
    if (o.status !== '受付' && o.status !== '支払い待ち') return u.fail('この受付は取り消せません（' + o.status + '）。', 'state');
    if (o.payStatus === '支払い済み') return u.fail('お支払い済みのため、お電話でお願いします（返金の手続きをします）。', 'call');
    ctx.db.update('orders', o.id, { status: '取り消し', cancelReason: 'お客様が取り消し', payStatus: o.pay === '事前' ? '取り消し' : o.payStatus });
    cancelPayLink(ctx, o);
    restore(ctx, o, 'お客様が取り消し');
    c.audit(ctx, '取り置きを取り消し（お客様）', o.id);
    N.send(ctx, ctx.db.get('customers', o.customerId), { kind: '取り消し', template: 'order_cancelled', refId: o.id, mode: 'reply', vars: { 番号: o.id, 理由: 'ご連絡ありがとうございました。' } });
    return { ok: true, id: o.id };
  }

  return {
    stockId: stockId, qtyOf: qtyOf, freeQty: freeQty, mark: mark, liveHolds: liveHolds, schools: schools, schoolItems: schoolItems, item: item,
    cart: cart, cartAdd: cartAdd, cartSet: cartSet, checkoutInfo: checkoutInfo, pickupDays: pickupDays, placeOrder: placeOrder, orderDone: orderDone,
    devPay: devPay, checkPayment: checkPayment, expireUnpaid: expireUnpaid, view: view, waitAdd: waitAdd, waitView: waitView, waitCancel: waitCancel,
    restockOpen: restockOpen, waitingFor: waitingFor, notifyWaiters: notifyWaiters, releasePriority: releasePriority, findOwned: findOwned,
    orderCancel: orderCancel, restore: restore, keepUntil: keepUntil, cancelPayLink: cancelPayLink, linesText: linesText, receiveText: receiveText, sendReceived: sendReceived
  };
})();
