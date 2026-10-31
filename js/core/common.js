/* ココスポーツ 本番：どの機能も使う小道具（設定の読み出し・お客様の特定・記録・リンク）
   ctx（呼び出しごとの入れ物）の形：
   {
     db:   { all(t), get(t,key), insert(t,row), update(t,key,patch), remove(t,key), nextId(prefix) },
     now:  () => {date, min, ts},
     user: { lineUserId, lineName, shopEmail, role },   // role: 'owner' | 'admin' | 'staff' | ''
     out:  { line(to, text, opts) => {ok, error}, mail(to, subject, body) => {ok, error},
             pay: { create(order, info) => {ok, url, ref, error}, status(ref) => 'paid'|'open'|'canceled' } },
     baseUrl: 'https://…/'   // お客様の画面の住所（リンクを作るとき）
   } */
KS.core.c = (function () {
  var u = KS.core.u;

  /* 設定を1つのまとまりで返す。表に無いものは最初の値 */
  function cfg(ctx) {
    if (ctx._cfg) return ctx._cfg;
    var base = KS.core.model.settings(), rows = ctx.db.all('settings');
    rows.forEach(function (r) { base[r.key] = typeof r.value === 'string' ? safeJson(r.value, r.value) : r.value; });
    ctx._cfg = base;
    return base;
  }
  function safeJson(s, fb) { try { return JSON.parse(s); } catch (e) { return fb; } }
  function setCfg(ctx, key, value) {
    if (ctx.db.get('settings', key)) ctx.db.update('settings', key, { value: JSON.stringify(value) });
    else ctx.db.insert('settings', { key: key, value: JSON.stringify(value) });
    ctx._cfg = null;
  }

  function audit(ctx, action, target) {
    var who = ctx.user && ctx.user.shopEmail ? memberName(ctx, ctx.user.shopEmail) : (ctx.user && ctx.user.lineUserId ? 'お客様（LINE）' : 'お客様');
    if (ctx.user && ctx.user.system) who = '自動の処理';
    ctx.db.insert('audit', { id: ctx.db.nextId('A'), at: u.stamp(ctx.now().ts), who: who, action: action, target: target || '' });
  }
  function memberName(ctx, email) {
    var m = cfg(ctx).shopMembers.filter(function (x) { return x.email === email; })[0];
    return m ? m.name : email;
  }

  /* 営業日か */
  function isOpen(ctx, date) {
    var c = cfg(ctx);
    if (c.openDays.indexOf(u.wd(date)) < 0) return false;
    return !ctx.db.get('holidays', date);
  }
  function holidayReason(ctx, date) { var h = ctx.db.get('holidays', date); return h ? h.reason : ''; }

  /* --- お客様 --- */
  function customerByLine(ctx, lineUserId) {
    if (!lineUserId) return null;
    return ctx.db.all('customers').filter(function (x) { return x.lineUserId === lineUserId; })[0] || null;
  }
  /* LINEの中の人：無ければ作る（名前や電話はまだ空） */
  function meLine(ctx) {
    var uid = ctx.user && ctx.user.lineUserId;
    if (!uid) return null;
    var c = customerByLine(ctx, uid);
    if (c) return c;
    return ctx.db.insert('customers', {
      id: ctx.db.nextId('C'), lineUserId: uid, lineName: ctx.user.lineName || '', name: '', kana: '', phone: '', email: '',
      schoolId: '', firstSource: 'LINE', heardFrom: '', createdAt: ctx.now().date, blocked: false, memo: '', marketingOk: false, mergedInto: ''
    });
  }
  /* 同じ方を探す（電話・メールが一致すれば同じ方。カナと電話の下4桁なら候補） */
  function findCustomer(ctx, phone, email, kana) {
    var p = u.normPhone(phone), e = u.normEmail(email), k = u.normKana(kana);
    var cs = ctx.db.all('customers').filter(function (c) { return !c.mergedInto; });
    var hit = cs.filter(function (c) { return (p && c.phone === p) || (e && c.email === e); })[0];
    if (hit) return { customer: hit };
    var cand = cs.filter(function (c) { return k && c.kana === k && p && c.phone && c.phone.slice(-4) === p.slice(-4); })[0];
    return { customer: null, candidate: cand || null };
  }
  /* 予約・取り置きの連絡先から、お客様の行を決める（LINEの人はLINEの行に書き足す） */
  function resolveCustomer(ctx, contact, source) {
    var me = meLine(ctx), now = ctx.now();
    var patch = {};
    if (contact.name) patch.name = String(contact.name).trim();
    if (contact.kana) patch.kana = u.normKana(contact.kana);
    if (contact.phone) patch.phone = u.normPhone(contact.phone);
    if (contact.email) patch.email = u.normEmail(contact.email);
    if (contact.schoolId) patch.schoolId = contact.schoolId;
    if (contact.heardFrom) patch.heardFrom = contact.heardFrom;
    if (contact.marketingOk) patch.marketingOk = true;
    if (me) { return ctx.db.update('customers', me.id, patch); }
    var f = findCustomer(ctx, contact.phone, contact.email, contact.kana);
    if (f.customer) return ctx.db.update('customers', f.customer.id, patch);
    var row = {
      id: ctx.db.nextId('C'), lineUserId: '', lineName: '', name: '', kana: '', phone: '', email: '', schoolId: '',
      firstSource: source || '', heardFrom: '', createdAt: now.date, blocked: false, memo: f.candidate ? '同じ方かもしれない：' + f.candidate.id : '', marketingOk: false, mergedInto: ''
    };
    for (var k in patch) row[k] = patch[k];
    return ctx.db.insert('customers', row);
  }
  /* お客様の表示名 */
  function nameOf(c) { return c ? (c.name || c.lineName || 'お客様') : 'お客様'; }

  /* --- リンク --- */
  function link(ctx, path) { return (ctx.baseUrl || '') + '#/c/' + path; }

  /* --- 品物 --- */
  function product(ctx, id) { return ctx.db.get('products', id); }
  function school(ctx, id) { return ctx.db.get('schools', id); }
  function productLabel(ctx, pid, size) {
    var p = product(ctx, pid); if (!p) return '（品物）';
    var s = p.schoolId ? school(ctx, p.schoolId) : null;
    return (s ? s.short + ' ' : '') + p.name + (size ? '（' + sizeLabel(p, size) + '）' : '');
  }
  /* サイズごとの価格・表示名は {サイズ: 値} で持つ。シートから文字で戻ることもあるので、ここで読みほどく */
  function mapOf(v) {
    if (!v) return null;
    if (typeof v === 'string') v = safeJson(v, null);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  }
  /* 価格：そのサイズの価格があればそれ、無ければ品物の価格（price） */
  function priceOf(p, size) {
    if (!p) return 0;
    var sp = mapOf(p.sizePrices);
    if (sp && size != null && sp[size] !== undefined && sp[size] !== null && sp[size] !== '' && !isNaN(+sp[size])) return +sp[size];
    return +p.price || 0;
  }
  /* いちばん安い・高い価格（C11 の「2,300円〜」と、S05・S08 の見出しに使う） */
  function priceRange(p) {
    var list = (p && p.sizes && p.sizes.length ? p.sizes : [null]).map(function (z) { return priceOf(p, z); });
    var min = Math.min.apply(null, list), max = Math.max.apply(null, list);
    return { min: min, max: max, varies: min !== max };
  }
  /* サイズの表示名：「5S(120)」など。無ければサイズそのまま */
  function sizeLabel(p, size) {
    var sl = mapOf(p && p.sizeLabels);
    return (sl && sl[size]) || String(size == null ? '' : size);
  }

  return {
    cfg: cfg, setCfg: setCfg, audit: audit, memberName: memberName, isOpen: isOpen, holidayReason: holidayReason,
    customerByLine: customerByLine, meLine: meLine, findCustomer: findCustomer, resolveCustomer: resolveCustomer, nameOf: nameOf,
    link: link, product: product, school: school, productLabel: productLabel, safeJson: safeJson,
    mapOf: mapOf, priceOf: priceOf, priceRange: priceRange, sizeLabel: sizeLabel
  };
})();
