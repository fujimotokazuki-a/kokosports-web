/* ココスポーツ 本番：お客様へのお知らせ（L4 と メール）
   - LINEの人にはLINE、そうでない人にはメール（決1）
   - お客様の操作のすぐあとの確認は「返信」で送るので通数を使わない（mode: 'reply'）
   - それ以外（前日・入荷・発送など）は「プッシュ」で1人1通。月の通数を数える（無料は月200通）
   - 前日のお知らせは、月の残りが一定（30通）を切ったら止めて、S07 で本人に知らせる（決5） */
KS.core.notify = (function () {
  var u = KS.core.u, c = KS.core.c;

  function fill(tpl, vars) {
    return String(tpl || '').replace(/\{([^}]+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : ''; });
  }
  function shopVars(ctx) {
    var s = c.cfg(ctx).shop;
    return { 営業時間: s.hours, 定休: s.closedText, 電話: s.tel, 店名: s.name };
  }

  /* 今月LINEで送った通数（プッシュだけ） */
  function usedThisMonth(ctx) {
    var m = u.month(ctx.now().date);
    return u.sum(ctx.db.all('notices').filter(function (n) {
      return n.channel === 'LINE' && n.status === '送信済み' && String(n.at).slice(0, 7) === m;
    }), function (n) { return n.count || 0; });
  }
  function quota(ctx) {
    var q = c.cfg(ctx).line, used = usedThisMonth(ctx);
    return { quota: q.monthlyQuota, used: used, left: Math.max(0, q.monthlyQuota - used), stopUnder: q.stopReminderUnder };
  }

  /* お知らせを1件送る
     opts: { kind:'受付'|'前日'|'入荷'|…, template:'order_received', vars:{}, refId, mode:'reply'|'push', optional:true(前日など止めてよいもの), subject } */
  function send(ctx, customer, opts) {
    var cf = c.cfg(ctx), vars = shopVars(ctx), k;
    for (k in (opts.vars || {})) vars[k] = opts.vars[k];
    vars['名前'] = vars['名前'] || c.nameOf(customer);
    var text = fill(cf.templates[opts.template] || opts.text || '', vars);
    var now = ctx.now(), rec = {
      id: ctx.db.nextId('N'), at: u.stamp(now.ts), kind: opts.kind, template: opts.template || '', customerId: customer ? customer.id : '',
      refId: opts.refId || '', channel: '', mode: '', count: 0, status: '', text: text, error: ''
    };
    var useLine = customer && customer.lineUserId && !customer.blocked;
    if (useLine) {
      rec.channel = 'LINE';
      /* 返信で送れるのは、その人がLINEの中で自分で操作した直後だけ（画面が受付番号をトークに送り、返信で返す）。
         5分ごとの処理・店の操作・LINEの外のブラウザで開いたときはプッシュにする */
      var self = ctx.user && !ctx.user.system && ctx.user.lineUserId === customer.lineUserId && ctx.user.inClient !== false;
      rec.mode = opts.mode === 'reply' && self ? 'reply' : 'push';
      if (rec.mode === 'push') {
        var q = quota(ctx);
        if (q.left < 1) { rec.status = '未送信'; rec.error = '今月の通数が残っていません'; return save(ctx, rec); }
        if (opts.optional && q.left < q.stopUnder) { rec.status = '止めた'; rec.error = '残りが' + q.stopUnder + '通を切ったため、前日のお知らせを止めました'; return save(ctx, rec); }
      }
      var r = ctx.out.line(customer.lineUserId, text, { mode: rec.mode, refId: rec.refId, kind: opts.kind, link: vars['リンク'] || '' });
      rec.status = r && r.ok ? (rec.mode === 'reply' ? '返信で送る' : '送信済み') : '未送信';
      rec.count = r && r.ok && rec.mode === 'push' ? 1 : 0;
      if (r && r.blocked) { ctx.db.update('customers', customer.id, { blocked: true }); rec.error = 'ブロックされています'; rec.status = '未送信'; }
      else if (!(r && r.ok)) rec.error = (r && r.error) || '送れませんでした';
      return save(ctx, rec);
    }
    var to = customer && customer.email;
    if (to) {
      rec.channel = 'メール'; rec.mode = 'mail';
      var subj = '【' + cf.shop.name + '】' + (opts.subject || opts.kind);
      var body = text + '\n\n――\n' + cf.shop.name + '\n' + cf.shop.address + '\n電話 ' + cf.shop.tel + '（' + cf.shop.hours + '、' + cf.shop.closedText + '）\nこのメールは送信専用です。';
      var m = ctx.out.mail(to, subj, body);
      rec.status = m && m.ok ? '送信済み' : '未送信';
      if (!(m && m.ok)) rec.error = (m && m.error) || '送れませんでした';
      return save(ctx, rec);
    }
    rec.channel = 'なし'; rec.status = '未送信'; rec.error = '連絡先がありません（電話で）';
    return save(ctx, rec);
  }
  function save(ctx, rec) { ctx.db.insert('notices', rec); return rec; }

  /* S07：お知らせの記録 */
  function log(ctx, args) {
    var m = (args && args.month) || u.month(ctx.now().date);
    var rows = ctx.db.all('notices').filter(function (n) { return String(n.at).slice(0, 7) === m; }).slice().reverse();
    var byKind = {};
    rows.forEach(function (n) {
      var k = n.kind || 'そのほか';
      byKind[k] = byKind[k] || { kind: k, line: 0, push: 0, mail: 0, failed: 0 };
      if (n.channel === 'LINE') { byKind[k].line++; byKind[k].push += n.count || 0; }
      if (n.channel === 'メール') byKind[k].mail++;
      if (n.status === '未送信' || n.status === '止めた') byKind[k].failed++;
    });
    var out = rows.slice(0, 300).map(function (n) { var r = u.clone(n), x = n.customerId ? ctx.db.get('customers', n.customerId) : null; r.customerName = x ? c.nameOf(x) : ''; return r; });
    return { ok: true, month: m, quota: quota(ctx), byKind: Object.keys(byKind).map(function (k) { return byKind[k]; }), rows: out };
  }

  return { fill: fill, send: send, quota: quota, usedThisMonth: usedThisMonth, log: log };
})();
