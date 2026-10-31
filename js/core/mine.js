/* ココスポーツ 本番：お客様の入口と「わたしの予約」（C00・C01・C40・C41・C50・C60）＋時間で動く処理 */
KS.core.mine = (function () {
  var u = KS.core.u, c = KS.core.c, G = KS.core.goods, B = KS.core.booking, N = KS.core.notify;

  /* 画面を開いたとき最初に1回。LINEの中か、店の情報、作った段階 */
  function boot(ctx) {
    var cf = c.cfg(ctx), me = c.meLine(ctx);
    return {
      ok: true, inLine: !!me, shop: cf.shop, stages: cf.stages, openDays: cf.openDays, open: cf.open, close: cf.close,
      today: ctx.now().date, now: ctx.now(), legal: cf.legal, heard: KS.core.model.HEARD, sampleData: !!cf.sampleData,
      profile: me ? { name: me.name, kana: me.kana, phone: me.phone, email: me.email, schoolId: me.schoolId, lineName: me.lineName } : null,
      holidays: ctx.db.all('holidays').filter(function (h) { return h.date >= ctx.now().date; }).slice(0, 10)
    };
  }

  /* C40 わたしの予約（LINEの人だけ） */
  function myList(ctx) {
    var me = c.meLine(ctx);
    if (!me) return u.fail('LINEから開くと、ご予約の一覧が見られます。確認のメールのリンクからもご覧いただけます。', 'line');
    var mine = function (t) { return ctx.db.all(t).filter(function (x) { return x.customerId === me.id; }); };
    var today = ctx.now().date;
    var orders = mine('orders').filter(function (o) { return o.status !== '取り消し' || o.createdDate >= u.addDays(today, -30); }).map(function (o) { return G.view(ctx, o); });
    var salon = mine('salonBookings').filter(function (b) { return b.date >= u.addDays(today, -30); }).map(function (b) { return B.salonView(ctx, b); });
    var measure = mine('measureBookings').filter(function (b) { return b.date >= u.addDays(today, -30); }).map(function (b) { return B.measureView(ctx, b); });
    var waits = mine('waits').filter(function (w) { return w.status === '待ち' || w.status === 'お知らせ済み'; }).map(function (w) { return G.waitView(ctx, w); });
    return { ok: true, orders: orders.reverse(), salon: salon.reverse(), measure: measure.reverse(), waits: waits.reverse() };
  }

  /* C41 詳細（kind: order / salon / measure / wait、token か id） */
  var TABLE = { order: 'orders', salon: 'salonBookings', measure: 'measureBookings', wait: 'waits' };
  function detail(ctx, args) {
    var t = TABLE[args.kind]; if (!t) return u.fail('ページが見つかりません。', 'gone');
    var row = G.findOwned(ctx, t, args);
    if (!row) return u.fail('この予約はもうありません（取り消し済みか、リンクが古くなっています）。', 'gone');
    if (args.kind === 'order') row = G.checkPayment(ctx, row);
    var v = args.kind === 'order' ? G.view(ctx, row) : args.kind === 'salon' ? B.salonView(ctx, row) : args.kind === 'measure' ? B.measureView(ctx, row) : G.waitView(ctx, row);
    var voice = null;
    if (args.kind === 'salon' && row.status === '来店済み' && c.cfg(ctx).stages.voice) {
      var done = ctx.db.all('reviews').some(function (r) { return r.refId === row.id; });
      voice = { canWrite: !done };
    }
    return { ok: true, item: v, voice: voice, shop: c.cfg(ctx).shop, inLine: !!c.meLine(ctx) };
  }
  function cancel(ctx, args) {
    if (args.kind === 'order') return G.orderCancel(ctx, args);
    if (args.kind === 'salon') return B.salonCancel(ctx, args);
    if (args.kind === 'measure') return B.measureCancel(ctx, args);
    if (args.kind === 'wait') return G.waitCancel(ctx, args);
    return u.fail('取り消せません。', 'state');
  }

  /* C50 来店後の声。点数で案内を分けない：だれにでも同じ文でGoogleの口コミを案内する（D-004） */
  function voice(ctx, args) {
    var cf = c.cfg(ctx);
    var stars = Math.max(1, Math.min(5, +args.stars || 0));
    if (!args.stars) return u.fail('星をえらんでください。', 'input');
    var row = args.token ? ctx.db.all('salonBookings').filter(function (b) { return b.token === args.token; })[0] : null;
    var me = c.meLine(ctx);
    var rev = ctx.db.insert('reviews', {
      id: ctx.db.nextId('V'), at: u.stamp(ctx.now().ts), date: ctx.now().date, customerId: row ? row.customerId : (me ? me.id : ''), refId: row ? row.id : '',
      stars: stars, text: String(args.text || '').slice(0, 1000), toShop: String(args.toShop || '').slice(0, 1000), source: args.source || (row ? '予約' : '店頭のQR')
    });
    return { ok: true, id: rev.id, googleUrl: cf.shop.googleReviewUrl || '', message: 'ありがとうございました。よろしければ、Googleにもご感想をお寄せください。' };
  }

  /* ================= 時間で動く処理（Apps Script では5分ごとのトリガー） ================= */
  function runJobs(ctx) {
    var cf = c.cfg(ctx), now = ctx.now(), r = { holds: 0, priority: 0, unpaid: 0, paid: 0, dayBefore: 0, noShow: 0, expired: 0 };
    ctx.user = ctx.user || {}; ctx.user.system = true;
    /* かごの期限切れ */
    ctx.db.all('holds').forEach(function (h) {
      if (h.status === '押さえ中' && h.expiresAt <= now.ts) { ctx.db.update('holds', h.id, { status: '期限切れ' }); r.holds++; }
    });
    /* 入荷のお知らせの優先（24時間）が切れた → その人は終了、次の人へ */
    ctx.db.all('waits').forEach(function (w) {
      if (w.status !== 'お知らせ済み' || w.priorityUntil > now.ts) return;
      ctx.db.update('waits', w.id, { status: '終了', endReason: '24時間たっても取り置きがなかった' });
      G.releasePriority(ctx, w.id);
      var free = G.freeQty(ctx, w.productId, w.size);
      if (free > 0) r.priority += G.notifyWaiters(ctx, w.productId, w.size, free).sent.length;
    });
    /* 事前決済：支払い済みの確認と、30分たっても払われないものの取り消し */
    ctx.db.all('orders').forEach(function (o) {
      if (o.status !== '支払い待ち') return;
      var before = o.payStatus, after = G.checkPayment(ctx, o);
      if (after.payStatus === '支払い済み' && before !== '支払い済み') r.paid++;
      if (after.status === '取り消し') r.unpaid++;
    });
    /* 前日のお知らせ（決5）：17時を過ぎたら明日の分を送る。残りが少なければ止める */
    if (now.min >= cf.line.dayBeforeAt) {
      var tmr = u.addDays(now.date, 1);
      ctx.db.all('orders').forEach(function (o) {
        if (o.method !== '店頭' || o.pickupDate !== tmr || o.remindedDayBefore || (o.status !== '受付' && o.status !== '用意済み')) return;
        N.send(ctx, ctx.db.get('customers', o.customerId), { kind: '前日', template: 'order_dayBefore', refId: o.id, mode: 'push', optional: true, subject: '明日はお受け取りの日です', vars: { 日付: u.jpDate(o.pickupDate), 品物: G.linesText(o) } });
        ctx.db.update('orders', o.id, { remindedDayBefore: true }); r.dayBefore++;
      });
      ctx.db.all('salonBookings').forEach(function (b) {
        if (b.date !== tmr || b.status !== '予約' || b.reminded || b.channel === '電話' || b.channel === '店頭') return;
        N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '前日', template: 'salon_dayBefore', refId: b.id, mode: 'push', optional: true, subject: '明日はご予約の日です', vars: B.salonVars(ctx, b) });
        ctx.db.update('salonBookings', b.id, { reminded: true }); r.dayBefore++;
      });
      ctx.db.all('measureBookings').forEach(function (b) {
        if (b.date !== tmr || b.status !== '予約' || b.reminded) return;
        N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '前日', template: 'measure_dayBefore', refId: b.id, mode: 'push', optional: true, subject: '明日は採寸のご予約日です', vars: B.measureVars(ctx, b) });
        ctx.db.update('measureBookings', b.id, { reminded: true }); r.dayBefore++;
      });
    }
    /* 受け取りに来ない：翌日に1回お知らせ、受け取り日から7日で取り消して在庫に戻す */
    ctx.db.all('orders').forEach(function (o) {
      if (o.method !== '店頭' || !o.pickupDate || (o.status !== '受付' && o.status !== '用意済み')) return;
      var late = u.daysBetween(o.pickupDate, now.date);
      if (late >= 1 && !o.noShowNotified && now.min >= cf.open) {
        var until = G.keepUntil(ctx, o);
        N.send(ctx, ctx.db.get('customers', o.customerId), { kind: '期限', template: 'order_noShow', refId: o.id, mode: 'push', subject: '取り置きの品をお預かりしています', vars: { 品物: G.linesText(o), 期限: u.jpDate(until) } });
        ctx.db.update('orders', o.id, { noShowNotified: true }); r.noShow++;
      }
      if (now.date > G.keepUntil(ctx, o)) {
        ctx.db.update('orders', o.id, { status: '取り消し', cancelReason: '受け取りの期限（' + cf.pickup.keepDays + '日）が過ぎた' });
        G.restore(ctx, o, '期限切れ');
        c.audit(ctx, '期限切れで取り消し', o.id);
        N.send(ctx, ctx.db.get('customers', o.customerId), { kind: '取り消し', template: 'order_cancelled', refId: o.id, mode: 'push', vars: { 番号: o.id, 理由: '受け取りの期限が過ぎたため、取り置きを取り消しました。またのご来店をお待ちしています。' } });
        r.expired++;
      }
    });
    return { ok: true, ran: r, at: u.stamp(now.ts) };
  }

  return { boot: boot, myList: myList, detail: detail, cancel: cancel, voice: voice, runJobs: runJobs };
})();
