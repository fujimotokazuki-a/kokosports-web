/* ココスポーツ 本番：試しの形の裏側（このPCのブラウザの中だけ）
   - core と同じ規則を、ブラウザの中の表（localStorage）で動かす
   - LINE・メール・Square には送らず、「届いたもの」として残す（試しの道具で見られる）
   - 時計を進められる（前日のお知らせ・24時間の繰り上げ・未払いの取り消しを試すため） */
KS.local = (function () {
  var KEY = 'kokosports_v1', u = KS.core.u;
  var st = null;

  function fresh() {
    var ts = Date.now(), s = KS.core.seed.initial(true, ts);
    return { version: 1, tables: s.tables, seq: s.seq, offset: 0, outbox: [], pays: {}, dev: { as: 'line:Udemo1000', shopEmail: '', newLine: 0 }, createdAt: ts };
  }
  function load() {
    if (st) return st;
    try { var raw = localStorage.getItem(KEY); if (raw) st = JSON.parse(raw); } catch (e) { st = null; }
    if (!st || st.version !== 1) { st = fresh(); save(); }
    return st;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* 保存できなくても動かす */ } }
  function reset() { st = fresh(); save(); }

  var db = {
    all: function (t) { return load().tables[t] || (st.tables[t] = []); },
    get: function (t, key) { var k = KS.core.model.TABLES[t]; return db.all(t).filter(function (r) { return r[k] === key; })[0] || null; },
    insert: function (t, row) { db.all(t).push(row); return row; },
    update: function (t, key, patch) { var r = db.get(t, key); if (!r) return null; for (var p in patch) r[p] = patch[p]; return r; },
    remove: function (t, key) { var k = KS.core.model.TABLES[t], a = db.all(t); for (var i = a.length - 1; i >= 0; i--) if (a[i][k] === key) a.splice(i, 1); },
    nextId: function (p) { var s = load(); s.seq[p] = (s.seq[p] || 0) + 1; return KS.core.seed.idOf(p, s.seq[p], now().ts); }
  };
  function now() { return u.nowOf(Date.now() + (load().offset || 0)); }

  /* LINE・メール・Square の代わり */
  var out = {
    line: function (to, text, opts) {
      var cust = db.all('customers').filter(function (c) { return c.lineUserId === to; })[0];
      if (cust && cust.blocked) return { ok: false, blocked: true, error: 'ブロックされています' };
      load().outbox.unshift({ at: u.stamp(now().ts), via: 'LINE', mode: opts.mode, to: to, toName: cust ? (cust.name || cust.lineName) : to, kind: opts.kind, ref: opts.refId || '', text: text });
      return { ok: true };
    },
    mail: function (to, subject, body) { load().outbox.unshift({ at: u.stamp(now().ts), via: 'メール', mode: 'mail', to: to, toName: to, kind: subject, text: body }); return { ok: true }; },
    pay: {
      create: function (o) { var ref = 'sq_local_' + o.id; load().pays[ref] = 'open'; return { ok: true, ref: ref, url: '#/c/pay/' + o.token }; },
      status: function (ref) { return load().pays[ref] || 'open'; },
      devSet: function (ref, v) { load().pays[ref] = v; },
      /* 試しの形：Squareの画面で返金したことにする */
      refundStatus: function () { return 'refunded'; }
    }
  };

  /* 試しの道具で選ぶ「だれとして開くか」 */
  function user() {
    var d = load().dev, uobj = { lineUserId: '', lineName: '', shopEmail: '', role: '' };
    if (d.as.indexOf('line:') === 0) {
      uobj.lineUserId = d.as.slice(5);
      var c = db.all('customers').filter(function (x) { return x.lineUserId === uobj.lineUserId; })[0];
      uobj.lineName = c ? c.lineName : '新しい友だち';
    }
    if (d.shopEmail) { uobj.shopEmail = d.shopEmail; }
    return uobj;
  }

  function call(name, args) {
    load();
    var ctx = { db: db, now: now, user: user(), out: out, baseUrl: KS.config.baseUrl || (location.origin + location.pathname) };
    if (ctx.user.shopEmail) ctx.user.role = KS.core.api.roleOf(ctx, ctx.user.shopEmail);
    /* 呼ぶたびに時間で動く処理も回す（本番は5分ごとのトリガー） */
    KS.core.api.handle({ db: db, now: now, user: { system: true }, out: out, baseUrl: ctx.baseUrl }, 'runJobs', {}, { dev: true });
    var res = KS.core.api.handle(ctx, name, u.clone(args || {}), { dev: true });
    save();
    return u.clone(res);
  }

  /* 試しの道具 */
  var dev = {
    state: function () { return load(); },
    setAs: function (as) { load().dev.as = as; save(); },
    newLineFriend: function () { var s = load(); s.dev.newLine = (s.dev.newLine || 0) + 1; s.dev.as = 'line:Unew' + s.dev.newLine; save(); },
    shopLogin: function (email) { load().dev.shopEmail = email || ''; save(); },
    advance: function (min) { load().offset += min * 60000; call('boot', {}); save(); },
    resetClock: function () { load().offset = 0; save(); },
    now: now, reset: reset, outbox: function () { return load().outbox; },
    clearOutbox: function () { load().outbox = []; save(); },
    lineUsers: function () { return db.all('customers').filter(function (c) { return c.lineUserId; }).slice(0, 8).map(function (c) { return { as: 'line:' + c.lineUserId, name: c.name || c.lineName }; }); }
  };

  return { call: call, dev: dev, db: db };
})();
