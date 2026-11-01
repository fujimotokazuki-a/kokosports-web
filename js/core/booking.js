/* ココスポーツ 本番：採寸の予約（F3）と水素サロンの予約（F5）
   水素サロン（デモの規則をそのまま引き継ぐ）
   - 席は2つ。お客様は席を選ばず、空いている方に入る
   - 押さえる時間＝コースの時間＋準備。開始は30分刻み。2名同時は2席とも空いている枠だけ
   - 受付は30日先まで、締め切りは2時間前、お客様のキャンセル・変更は3時間前まで
   - お試しは初めての方だけ（電話・メール・LINEで同じ方を探して判定）
   採寸
   - 枠ごとに「組」の定員。兄弟は人数で1組にまとめる */
KS.core.booking = (function () {
  var u = KS.core.u, c = KS.core.c, N = KS.core.notify;

  /* ================= 水素サロン ================= */
  function menus(ctx, all) {
    return ctx.db.all('salonMenus').filter(function (m) { return all || m.visible; }).sort(u.by('sort'));
  }
  function menu(ctx, id) { return ctx.db.get('salonMenus', id); }
  function active(b) { return b.status === '予約' || b.status === '来店済み'; }

  function busySeats(ctx, date, start, end, ignoreId) {
    var used = {};
    ctx.db.all('salonBookings').forEach(function (b) {
      if (b.date !== date || !active(b) || b.id === ignoreId) return;
      if (b.start < end && start < b.holdUntil) b.seatIds.forEach(function (s) { used[s] = true; });
    });
    ctx.db.all('salonBlocks').forEach(function (b) {
      if (b.date !== date) return;
      if (b.start < end && start < b.end) b.seatIds.forEach(function (s) { used[s] = true; });
    });
    return used;
  }
  function freeSeats(ctx, date, start, hold, ignoreId) {
    var used = busySeats(ctx, date, start, start + hold, ignoreId);
    return c.cfg(ctx).salon.seats.filter(function (s) { return !used[s.id]; }).map(function (s) { return s.id; });
  }
  function startTimes(ctx, m) {
    var cf = c.cfg(ctx), out = [];
    for (var t = cf.open; t + m.hold <= cf.close; t += cf.salon.step) out.push(t);
    return out;
  }
  /* 枠の印：○2席空き／△残り1席／×満席・締め切り／休 */
  function slotState(ctx, date, start, m, opts) {
    opts = opts || {};
    var cf = c.cfg(ctx), now = ctx.now();
    if (!c.isOpen(ctx, date)) return { mark: '休', ok: false, why: c.holidayReason(ctx, date) || '定休日' };
    var diff = u.daysBetween(now.date, date);
    if (!opts.asShop) {
      if (diff < 0 || (diff === 0 && start - now.min < cf.salon.deadlineMin)) return { mark: '×', ok: false, why: '受付を締め切りました' };
      if (diff > cf.salon.horizonDays) return { mark: '×', ok: false, why: '受付前です（' + cf.salon.horizonDays + '日先まで）' };
    }
    var free = freeSeats(ctx, date, start, m.hold, opts.ignoreId);
    if (free.length < m.seats) return { mark: '×', ok: false, why: '満席です', free: free };
    if (m.seats === 1 && free.length === 1) return { mark: '△', ok: true, why: '残り1席', free: free };
    return { mark: '○', ok: true, why: '空きあり', free: free };
  }

  /* C30 メニューと料金 */
  function salonMenus(ctx) {
    var cf = c.cfg(ctx), me = c.meLine(ctx);
    if (!cf.stages.salon) return { ok: true, closed: true, airReserve: cf.shop.airReserve, menus: [] };
    return { ok: true, menus: menus(ctx), firstTime: me ? isFirst(ctx, me.id) : null, rules: { cancelMin: cf.salon.cancelMin, deadlineMin: cf.salon.deadlineMin, horizonDays: cf.salon.horizonDays } };
  }
  /* C31 週の表 */
  function salonWeek(ctx, args) {
    var m = menu(ctx, args.menuId); if (!m) return u.fail('メニューを選んでください。', 'menu');
    var from = args.from || ctx.now().date, days = [];
    for (var i = 0; i < 7; i++) {
      var d = u.addDays(from, i);
      days.push({ date: d, open: c.isOpen(ctx, d), slots: startTimes(ctx, m).map(function (t) { var s = slotState(ctx, d, t, m, { ignoreId: args.ignoreId }); return { start: t, mark: s.mark, ok: s.ok, why: s.why }; }) });
    }
    return { ok: true, menu: m, from: from, days: days, today: ctx.now().date, horizon: u.addDays(ctx.now().date, c.cfg(ctx).salon.horizonDays) };
  }
  function isFirst(ctx, customerId) {
    return !ctx.db.all('salonBookings').some(function (b) { return b.customerId === customerId && (b.status === '来店済み' || (b.status === '予約' && menu(ctx, b.menuId) && menu(ctx, b.menuId).firstOnly)); });
  }
  /* C32 の初期値 */
  function salonForm(ctx) {
    var me = c.meLine(ctx);
    return { ok: true, profile: me ? { inLine: true, name: me.name, kana: me.kana, phone: me.phone, email: me.email, askHeard: !me.heardFrom } : { inLine: false, askHeard: true }, heard: KS.core.model.HEARD, legal: c.cfg(ctx).legal };
  }
  function validateContact(f, inLine, asShop) {
    var e = {};
    if (!String(f.name || '').trim()) e.name = 'お名前を入力してください。';
    if (!asShop && !u.normKana(f.kana)) e.kana = 'フリガナを入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!asShop && !inLine && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。確認のお知らせをお送りします。';
    if (!asShop && !f.agree) e.agree = 'プライバシーポリシーとキャンセルの決まりをご確認ください。';
    return e;
  }
  /* C33 → C34 予約を確定（空きの確認 → もう一度確認 → 保存。本番はロックの中） */
  function salonBook(ctx, args) {
    var f = args.form || {}, asShop = !!args.asShop, me = asShop ? null : c.meLine(ctx), cf = c.cfg(ctx);
    if (!asShop && !cf.stages.salon) return u.fail('ネットのご予約は準備中です。', 'closed');
    var m = menu(ctx, f.menuId); if (!m) return u.fail('メニューを選んでください。', 'menu');
    var errs = validateContact(f, !!me, asShop);
    if (Object.keys(errs).length) return u.fail('入力を確かめてください。', 'input', { errors: errs });
    var st = slotState(ctx, f.date, +f.start, m, { asShop: asShop });
    if (!st.ok) return u.fail(st.why === '満席です' ? '直前にほかの方の予約が入りました。別の時間をお選びください。' : st.why, 'slot');
    var found = me ? { customer: me } : c.findCustomer(ctx, f.phone, f.email, f.kana);
    if (m.firstOnly && found.customer && !isFirst(ctx, found.customer.id)) return u.fail('お試しは初めての方だけのメニューです。ほかのメニューをお選びください。', 'first');
    var free = freeSeats(ctx, f.date, +f.start, m.hold);
    if (free.length < m.seats) return u.fail('直前にほかの方の予約が入りました。別の時間をお選びください。', 'slot');
    var cust;
    if (asShop) {
      cust = found.customer ? ctx.db.update('customers', found.customer.id, { name: f.name || found.customer.name, phone: u.normPhone(f.phone) || found.customer.phone })
        : ctx.db.insert('customers', { id: ctx.db.nextId('C'), lineUserId: '', lineName: '', name: String(f.name).trim(), kana: u.normKana(f.kana), phone: u.normPhone(f.phone), email: u.normEmail(f.email || ''), schoolId: '', firstSource: f.channel || '電話', heardFrom: '', createdAt: ctx.now().date, blocked: false, memo: found.candidate ? '同じ方かもしれない：' + found.candidate.id : '', marketingOk: false, mergedInto: '' });
    } else cust = c.resolveCustomer(ctx, { name: f.name, kana: f.kana, phone: f.phone, email: f.email, heardFrom: f.heardFrom }, me ? 'LINE' : (args.utm && args.utm.source) || 'Web');
    var now = ctx.now();
    var b = ctx.db.insert('salonBookings', {
      id: ctx.db.nextId('R'), token: u.token(), customerId: cust.id, menuId: m.id, menuName: m.name, date: f.date, start: +f.start, end: +f.start + m.mins,
      holdUntil: +f.start + m.hold, seatIds: free.slice(0, m.seats), party: m.seats, status: '予約', channel: asShop ? (f.channel || '電話') : (me ? 'LINE' : 'Web'),
      heardFrom: f.heardFrom || '', note: String(f.note || ''), price: m.price, createdAt: u.stamp(now.ts), createdDate: now.date, reminded: false, utm: args.utm || null,
      contact: { name: String(f.name).trim(), phone: u.normPhone(f.phone), email: u.normEmail(f.email || '') }
    });
    c.audit(ctx, 'サロンの予約を登録', b.id + '（' + m.name + ' ' + f.date + ' ' + u.hm(+f.start) + '）');
    if (!asShop) N.send(ctx, cust, { kind: '受付', template: 'salon_received', refId: b.id, mode: 'reply', subject: '水素サロンのご予約を受け付けました', vars: salonVars(ctx, b) });
    return { ok: true, booking: salonView(ctx, b), candidate: found.candidate || null };
  }
  function salonVars(ctx, b) {
    return { メニュー: b.menuName, 日時: u.jpDate(b.date) + ' ' + u.hm(b.start) + '〜' + u.hm(b.end), リンク: c.link(ctx, 'my/salon/' + b.token) };
  }
  function minutesUntil(ctx, b) { var now = ctx.now(); return u.daysBetween(now.date, b.date) * 1440 + b.start - now.min; }
  function salonView(ctx, b) {
    var cf = c.cfg(ctx), left = minutesUntil(ctx, b);
    return {
      id: b.id, token: b.token, kind: 'salon', menuId: b.menuId, menuName: b.menuName, date: b.date, start: b.start, end: b.end, party: b.party, price: b.price,
      status: b.status, createdAt: b.createdAt, canChange: b.status === '予約' && left >= cf.salon.cancelMin, mustCall: b.status === '予約' && left < cf.salon.cancelMin && left > 0, contact: b.contact
    };
  }
  function salonCancel(ctx, args) {
    var b = KS.core.goods.findOwned(ctx, 'salonBookings', args); if (!b) return u.fail('この予約は見つかりません。', 'gone');
    if (b.status !== '予約') return u.fail('この予約は取り消せません（' + b.status + '）。', 'state');
    if (minutesUntil(ctx, b) < c.cfg(ctx).salon.cancelMin) return u.fail('3時間前を過ぎたため、ネットでは取り消せません。お電話でご連絡ください。', 'call');
    ctx.db.update('salonBookings', b.id, { status: '取り消し（お客様）', cancelReason: 'お客様がネットで取り消し' });
    c.audit(ctx, 'サロンの予約を取り消し（お客様）', b.id);
    N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '取り消し', template: 'salon_cancelled', refId: b.id, mode: 'reply', vars: salonVars(ctx, b) });
    return { ok: true, id: b.id };
  }
  /* C41 日時の変更 */
  function salonMove(ctx, args) {
    var b = KS.core.goods.findOwned(ctx, 'salonBookings', args); if (!b) return u.fail('この予約は見つかりません。', 'gone');
    if (b.status !== '予約' || minutesUntil(ctx, b) < c.cfg(ctx).salon.cancelMin) return u.fail('3時間前を過ぎたため、ネットでは変えられません。お電話でご連絡ください。', 'call');
    var m = menu(ctx, b.menuId), st = slotState(ctx, args.date, +args.start, m, { ignoreId: b.id });
    if (!st.ok) return u.fail(st.why === '満席です' ? 'その時間は埋まりました。別の時間をお選びください。' : st.why, 'slot');
    var free = freeSeats(ctx, args.date, +args.start, m.hold, b.id);
    ctx.db.update('salonBookings', b.id, { date: args.date, start: +args.start, end: +args.start + m.mins, holdUntil: +args.start + m.hold, seatIds: free.slice(0, m.seats), reminded: false });
    b = ctx.db.get('salonBookings', b.id);
    c.audit(ctx, 'サロンの予約の日時を変更（お客様）', b.id);
    N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '変更', template: 'salon_changed', refId: b.id, mode: 'reply', vars: salonVars(ctx, b) });
    return { ok: true, booking: salonView(ctx, b) };
  }

  /* ================= 採寸・試着 =================
     試着（予約を開けた小学校）：営業日の開店から 45分ごと・1枠2組。枠は表に持たず、ここで作る。
     枠の番号は日と時刻だけ（F2026-11-05-600）なので、学校が違っても同じ時間の試着は合わせて2組まで */
  function isFit(ctx, schoolId) { var s = c.school(ctx, schoolId); return !!(s && s.kind !== '中' && KS.core.goods.reserveOpen(ctx, schoolId)); }
  function fitSlots(ctx) {
    var cf = c.cfg(ctx), f = cf.reserve.fit, now = ctx.now(), out = [];
    for (var i = 0; i <= f.horizonDays; i++) {
      var d = u.addDays(now.date, i);
      if (!c.isOpen(ctx, d)) continue;
      for (var t = cf.open; t + f.stepMin <= cf.close; t += f.stepMin) {
        if (i === 0 && t < now.min + f.leadMin) continue;
        out.push({ id: 'F' + d + '-' + t, schoolId: '', date: d, start: t, end: t + f.mins, capacity: f.perSlot });
      }
    }
    return out;
  }
  function fitSlot(ctx, id) { return fitSlots(ctx).filter(function (s) { return s.id === id; })[0] || null; }
  function measureSchools(ctx) {
    var cf = c.cfg(ctx);
    var list = ctx.db.all('schools').filter(function (s) { return s.measure && s.visible !== false; }).sort(u.by('sort'));
    return { ok: true, open: !!cf.stages.measure, schools: list.map(function (s) { return { id: s.id, name: s.name, short: s.short, slots: slotsOf(ctx, s.id).length }; }) };
  }
  function slotsOf(ctx, schoolId, includePast) {
    if (isFit(ctx, schoolId)) return fitSlots(ctx);
    var now = ctx.now();
    return ctx.db.all('measureSlots').filter(function (s) {
      return s.schoolId === schoolId && (includePast || s.date > now.date || (s.date === now.date && s.start > now.min + 60));
    }).sort(function (a, b) { return a.date === b.date ? a.start - b.start : (a.date < b.date ? -1 : 1); });
  }
  function slotUsed(ctx, slotId, ignoreId) {
    return ctx.db.all('measureBookings').filter(function (b) { return b.slotId === slotId && b.status === '予約' && b.id !== ignoreId; }).length;
  }
  /* C25 学校と日程の枠 */
  function measureSlots(ctx, args) {
    var s = c.school(ctx, args.schoolId), fit = isFit(ctx, args.schoolId);
    if (!s || (!s.measure && !fit)) return u.fail('この学校の採寸はありません。', 'notfound');
    var list = slotsOf(ctx, s.id).map(function (x) { var left = x.capacity - slotUsed(ctx, x.id); return { id: x.id, date: x.date, start: x.start, end: x.end, left: Math.max(0, left), mark: left <= 0 ? '×' : (left <= 1 ? '△' : '○') }; });
    return { ok: true, school: s, slots: list, fit: fit, handText: fit ? c.cfg(ctx).reserve.handText : '' };
  }
  /* C26 → C17 */
  function measureBook(ctx, args) {
    var f = args.form || {}, me = c.meLine(ctx), cf = c.cfg(ctx);
    var fit = /^F/.test(String(f.slotId || ''));
    if (fit && !isFit(ctx, f.schoolId)) return u.fail('この学校の試着のご予約は、まだ始まっていません。', 'closed');
    if (!fit && !cf.stages.measure) return u.fail('採寸のご予約は準備中です。', 'closed');
    var slot = fit ? fitSlot(ctx, f.slotId) : ctx.db.get('measureSlots', f.slotId);
    if (!slot) return u.fail(fit ? 'その時間はご予約できません。ほかの時間をお選びください。' : '日程を選んでください。', 'slot');
    if (fit) slot = { id: slot.id, schoolId: String(f.schoolId), date: slot.date, start: slot.start, end: slot.end, capacity: slot.capacity };
    var e = {};
    var count = +f.count || 0;
    if (count < 1 || count > 5) e.count = '人数を選んでください。';
    if (!String(f.children || '').trim()) e.children = 'お子さまのお名前を入力してください。';
    if (!String(f.name || '').trim()) e.name = '保護者のお名前を入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!me && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。';
    if (!f.agree) e.agree = 'プライバシーポリシーをご確認ください。';
    if (Object.keys(e).length) return u.fail('入力を確かめてください。', 'input', { errors: e });
    if (slot.capacity - slotUsed(ctx, slot.id) < 1) return u.fail('この枠は埋まりました。ほかの日程をお選びください。', 'slot');
    var cust = c.resolveCustomer(ctx, { name: f.name, phone: f.phone, email: f.email, schoolId: slot.schoolId }, me ? 'LINE' : 'Web');
    var now = ctx.now();
    var b = ctx.db.insert('measureBookings', {
      id: ctx.db.nextId('M'), token: u.token(), slotId: slot.id, schoolId: slot.schoolId, date: slot.date, start: slot.start, end: slot.end,
      customerId: cust.id, count: count, children: String(f.children).trim(), status: '予約', createdAt: u.stamp(now.ts), reminded: false, type: fit ? '試着' : '採寸',
      contact: { name: String(f.name).trim(), phone: u.normPhone(f.phone), email: u.normEmail(f.email || '') }, note: String(f.note || ''), utm: args.utm || null
    });
    c.audit(ctx, (fit ? '試着' : '採寸') + 'の予約を登録', b.id + '（' + c.school(ctx, slot.schoolId).short + ' ' + slot.date + '）');
    N.send(ctx, cust, { kind: '受付', template: fit ? 'fit_received' : 'measure_received', refId: b.id, mode: 'reply', subject: (fit ? '試着のご来店' : '採寸') + 'のご予約を受け付けました', vars: measureVars(ctx, b) });
    return { ok: true, booking: measureView(ctx, b) };
  }
  function measureVars(ctx, b) {
    var s = c.school(ctx, b.schoolId);
    return { 学校: s ? s.name : '', 日時: u.jpDate(b.date) + ' ' + u.hm(b.start) + '〜' + u.hm(b.end), 人数: b.count, お渡し: c.cfg(ctx).reserve.handText, リンク: c.link(ctx, 'my/measure/' + b.token) };
  }
  function measureView(ctx, b) {
    var s = c.school(ctx, b.schoolId), now = ctx.now();
    var future = b.date > now.date || (b.date === now.date && b.start > now.min);
    return { id: b.id, token: b.token, kind: 'measure', type: b.type || '採寸', school: s ? s.name : '', schoolId: b.schoolId, date: b.date, start: b.start, end: b.end, count: b.count, children: b.children, status: b.status, createdAt: b.createdAt, canCancel: b.status === '予約' && future, contact: b.contact };
  }
  function measureCancel(ctx, args) {
    var b = KS.core.goods.findOwned(ctx, 'measureBookings', args); if (!b) return u.fail('この予約は見つかりません。', 'gone');
    if (b.status !== '予約') return u.fail('この予約は取り消せません。', 'state');
    ctx.db.update('measureBookings', b.id, { status: '取り消し', cancelReason: 'お客様が取り消し' });
    c.audit(ctx, '採寸の予約を取り消し（お客様）', b.id);
    return { ok: true, id: b.id };
  }

  return {
    menus: menus, menu: menu, active: active, freeSeats: freeSeats, startTimes: startTimes, slotState: slotState, salonMenus: salonMenus, salonWeek: salonWeek,
    salonForm: salonForm, salonBook: salonBook, salonView: salonView, salonVars: salonVars, salonCancel: salonCancel, salonMove: salonMove, isFirst: isFirst,
    measureSchools: measureSchools, measureSlots: measureSlots, slotsOf: slotsOf, slotUsed: slotUsed, measureBook: measureBook, measureView: measureView, measureVars: measureVars,
    measureCancel: measureCancel, minutesUntil: minutesUntil, isFit: isFit, fitSlots: fitSlots
  };
})();
