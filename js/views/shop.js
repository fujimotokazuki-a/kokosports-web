/* ココスポーツ 本番：店の画面（S00〜S08）。お母さんのスマホで使う。PCでも開ける
   住所：#/s（S01 今日）／#/s/cal（S02）／#/s/book（S03 予約を入れる・席の押さえ）／#/s/book/<予約>?d=<日付>（S03 変える）
         #/s/orders（S04）／#/s/orders/<番号>／#/s/stock（S05）／#/s/customers（S06）／#/s/customers/<ID>
         #/s/notices（S07）／#/s/settings（S08）／#/s/settings/<項目>／#/s/more（そのほか）
   入っていなければ S00（ログイン）
   業務画面の型：色を減らす・1画面で押すボタンは基本1つ・段に分ける・説明は折りたたみ */
KS.views = KS.views || {};   // app.js より先に読まれるので、ここでも入れ物を作る
KS.views.s = (function () {
  var ui = KS.ui, esc = ui.esc, ico = ui.ico, u = KS.core.u;
  function api(n, a) { return KS.api.call(n, a || {}); }

  /* 画面をまたいで覚えておく入力の途中 */
  var st = {
    bk: {}, bkErr: {}, bkDone: null,          // S03 新しい予約
    blk: {},                                   // S03 席の押さえ
    mv: {},                                    // S03 日時の変更
    stock: { sel: null, mode: 'in', qty: '', pv: null, scroll: false },
    merge: null,                               // S06 同じ方をまとめる
    set: null, edit: null, pSchool: '', scrollEdit: false   // S08
  };

  /* ================= 共通の部品 ================= */
  var TAB = [['', 'home', '今日'], ['cal', 'cal', 'カレンダー'], ['orders', 'bag', '取り置き'], ['stock', 'box', '在庫'], ['more', 'menu', 'そのほか']];
  var SIDE = [['', 'home', '今日'], ['cal', 'cal', 'カレンダー'], ['book', 'plus', '予約を入れる'], ['orders', 'bag', '取り置き・注文'], ['stock', 'box', '在庫と入荷'], ['customers', 'user', 'お客様'], ['notices', 'bell', 'お知らせの記録'], ['settings', 'gear', '設定']];

  function frame(cur, title, body, sub) {
    var tabCur = ['book', 'customers', 'notices', 'settings', 'more'].indexOf(cur) >= 0 ? 'more' : cur;
    return '<div class="sp">' +
      '<aside class="snav"><div class="sbrand">ココスポーツ<small>店の画面</small></div>' +
      SIDE.map(function (x) { return '<a href="#/s' + (x[0] ? '/' + x[0] : '') + '" class="' + (cur === x[0] ? 'on' : '') + '">' + ico(x[1]) + x[2] + '</a>'; }).join('') +
      '<div class="g">数字</div><a href="#/b">' + ico('chart') + '運営ボード</a></aside>' +
      '<main class="smain"><header class="shd"><h1>' + esc(title) + '</h1>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</header>' + body + '</main>' +
      '<nav class="stab">' + TAB.map(function (x) { return '<a href="#/s' + (x[0] ? '/' + x[0] : '') + '" class="' + (tabCur === x[0] ? 'on' : '') + '">' + ico(x[1]) + '<span>' + x[2] + '</span></a>'; }).join('') + '</nav>' +
      '</div>';
  }
  /* S00 ログイン（店のGoogleアカウント） */
  function login(r) {
    var gas = KS.config.backend === 'gas';
    var denied = gas && KS.shopAuth.token() && r && r.message;
    return '<div class="slogin"><div class="sbrand">ココスポーツ<small>店の画面</small></div>' +
      '<h1>店のGoogleアカウントで入ってください</h1>' +
      (gas ? '<div id="gbtn" class="gbtn"></div>' + (denied ? '<p class="notice warn">このアカウントでは入れません。店の名簿にあるアカウントで入り直してください。</p>' : '') +
        '<p class="t2s">一度入れば、次からはボタンを押すだけで入れます。</p>'
        : '<p class="notice">このPCで試すときは、右下の「試しの道具」で「オーナーで入る」を押してください。</p>') +
      '<p class="t2s">お客様の画面は <a class="ul" href="#/c">こちら</a></p></div>';
  }
  /* 読み込んで描く。calls は [[名前, 引数], …] か、Promise<[結果…]> を返す関数 */
  function page(cur, title, calls, draw) {
    var p = typeof calls === 'function' ? calls() : Promise.all(calls.map(function (c) { return api(c[0], c[1]); }));
    return p.then(function (rs) {
      for (var i = 0; i < rs.length; i++) {
        if (rs[i] && !rs[i].ok) {
          if (rs[i].code === 'auth') return login(rs[i]);
          return frame(cur, title, '<div class="notice ng">' + esc(rs[i].message || '読み込めませんでした。') + '</div><p><a class="ul" href="#/s">今日の画面へ戻る</a></p>');
        }
      }
      var out = draw.apply(null, rs);
      if (typeof out === 'string') out = { body: out };
      return frame(cur, out.title || title, out.body, out.sub);
    });
  }
  function btn(label, act, data, cls) {
    var d = '';
    for (var k in (data || {})) d += ' data-' + k + '="' + esc(data[k]) + '"';
    return '<button type="button" class="bbtn sm ' + (cls || '') + '" data-act="' + act + '"' + d + '>' + label + '</button>';
  }
  function sec(title, count, body, extra) {
    return '<section class="card"><div class="h2r"><h2>' + esc(title) + (count != null ? '<span class="cnt">' + count + '</span>' : '') + '</h2>' + (extra || '') + '</div>' + body + '</section>';
  }
  function row(main, sub, act, cls) {
    return '<div class="li ' + (cls || '') + '"><div class="lm">' + main + (sub ? '<div class="ls">' + sub + '</div>' : '') + '</div>' + (act ? '<div class="la">' + act + '</div>' : '') + '</div>';
  }
  function empty(t) { return '<div class="empty">' + esc(t) + '</div>'; }
  function cname(c) { return c ? esc(c.name || 'お客様') + ' 様' : ''; }
  function clink(c) { return c && c.id ? '<a class="ul" href="#/s/customers/' + encodeURIComponent(c.id) + '">' + cname(c) + '</a>' : cname(c); }
  function telFmt(p) {
    p = String(p || '');
    if (/^0[789]0\d{8}$/.test(p)) return p.slice(0, 3) + '-' + p.slice(3, 7) + '-' + p.slice(7);
    if (/^0\d{9}$/.test(p)) return p.slice(0, 4) + '-' + p.slice(4, 6) + '-' + p.slice(6);
    return p;
  }
  function telBtn(p) { return p ? '<a class="bbtn sm" href="tel:' + esc(p) + '">' + ico('tel') + '電話</a>' : ''; }
  function seatNames(ids) { return (ids || []).map(function (s) { return s === 'S1' ? '1' : s === 'S2' ? '2' : s; }).join('・'); }
  function tm(b) { return u.hm(b.start) + '〜' + u.hm(b.end); }
  function linesTxt(o) { return (o.lines || []).map(function (l) { return esc(l.label) + ' ×' + l.qty; }).join('、'); }
  function recvTxt(o) { return o.method === '配送' ? '配送' + (o.ship ? '・' + esc(o.ship.method) : '') : '店頭 ' + (o.pickupDate ? u.shortDate(o.pickupDate) : ''); }
  function payTxt(o) { return o.pay === '事前' ? 'ネットで先払い・' + esc(o.payStatus) : '店頭で会計'; }
  function mlabel(m) { return +m.slice(0, 4) + '年' + (+m.slice(5, 7)) + '月'; }
  function addMonth(m, n) { var y = +m.slice(0, 4), mm = +m.slice(5, 7) + n; while (mm < 1) { mm += 12; y--; } while (mm > 12) { mm -= 12; y++; } return y + '-' + u.pad(mm); }
  function timeOpts(from, to, step, sel) {
    var out = [];
    for (var t = from; t <= to; t += step) out.push({ value: t, label: u.hm(t) });
    return out;
  }
  /* その場の入力を覚える（描き直しで消えないように） */
  function keep(id, obj) {
    var el = document.getElementById(id); if (!el) return obj;
    var f = ui.form(el); for (var k in f) obj[k] = f[k];
    return obj;
  }
  function scopeForm(el) { return ui.form(el.closest('.frm') || document); }
  function done(msg) { return function (r) { if (!r.ok) { ui.toast(r.message || 'うまくいきませんでした'); return r; } if (msg) ui.toast(msg); return r; }; }

  /* お客様の行の次の一手（1つだけ） */
  function ordAct(o) {
    if (o.status === '受付' && o.method === '店頭') return btn('用意済み', 'sOrd', { id: o.id, s: '用意済み' });
    if (o.status === '用意済み') return btn('受け取り済み', 'sOrd', { id: o.id, s: '受け取り済み' }, 'pri');
    if (o.status === '受付' && o.method === '配送') return '<a class="bbtn sm" href="#/s/orders/' + encodeURIComponent(o.id) + '">発送する</a>';
    return '<span class="st">' + esc(o.status) + '</span>';
  }
  function ordMain(o, extra) {
    return '<a class="nm" href="#/s/orders/' + encodeURIComponent(o.id) + '">' + cname(o.customer) + '</a>' + (extra || '') + '<span class="idx">' + esc(o.id) + '</span>';
  }

  /* ================= S01 今日 ================= */
  function today(p) {
    var d = p.d || '';
    return page('', '今日', [['shopToday', d ? { date: d } : {}]], function (r) {
      var q = r.quota;
      var nav = '<div class="dnav"><a class="bbtn sm" href="#/s?d=' + u.addDays(r.date, -1) + '" aria-label="前の日">' + ico('back') + '</a><b>' + u.jpDate(r.date) + '</b>' +
        '<a class="bbtn sm" href="#/s?d=' + u.addDays(r.date, 1) + '" aria-label="次の日">' + ico('next') + '</a>' + (d ? '<a class="ul" href="#/s">今日に戻る</a>' : '') + (r.open ? '' : '<span class="st">お休みの日</span>') + '</div>';
      var warn = '';
      if (q.left < q.stopUnder) warn = '<div class="notice ng">今月のLINEの残りが <b>' + q.left + '</b> 通です。前日のお知らせを止めています。<a class="ul" href="#/s/notices">お知らせの記録</a></div>';
      else if (q.left < q.stopUnder * 2) warn = '<div class="notice warn">今月のLINEの残りが <b>' + q.left + '</b> 通です（' + q.stopUnder + '通を切ると前日のお知らせを止めます）。</div>';
      var sum = '<div class="sumline">受け取り<b>' + r.pickups.length + '</b>件　サロン<b>' + r.salon.length + '</b>件　採寸<b>' + r.measure.length + '</b>組　発送<b>' + r.ship.length + '</b>件</div>';

      var pick = r.pickups.map(function (o) { return row(ordMain(o), linesTxt(o) + '<br>' + payTxt(o), ordAct(o)); }).join('') || empty('この日の受け取りはありません');
      var salon = r.salon.map(function (b) {
        var act = b.status === '予約' ? btn('来店済み', 'sSal', { id: b.id, s: '来店済み' }) : '<span class="st">' + esc(b.status) + '</span>';
        return row('<span class="tm">' + tm(b) + '</span>' + clink(b.customer) + (b.party > 1 ? '<span class="t2s">ほか1名</span>' : ''),
          esc(b.menuName) + '・席 ' + seatNames(b.seatIds) + '・' + esc(b.channel) + (b.note ? '<br>メモ：' + esc(b.note) : '') + '　<a class="ul" href="#/s/book/' + encodeURIComponent(b.id) + '?d=' + b.date + '">変える</a>', act);
      }).join('') || empty('この日のサロンの予約はありません');
      var meas = r.measure.map(function (b) {
        var act = b.status === '予約' ? btn('来店済み', 'sMeas', { id: b.id, s: '来店済み' }) : '<span class="st">' + esc(b.status) + '</span>';
        return row('<span class="tm">' + tm(b) + '</span>' + clink(b.customer), esc(b.school) + '・' + b.count + '人（' + esc(b.children) + '）', act);
      }).join('') || empty('この日の採寸はありません');
      var ship = r.ship.map(function (o) { return row(ordMain(o), linesTxt(o) + '<br>' + recvTxt(o) + '・支払い済み', ordAct(o)); }).join('') || empty('発送を待っている注文はありません');
      var fresh = r.fresh.map(function (o) { return row(ordMain(o, '<span class="t2s">' + recvTxt(o) + '</span>'), linesTxt(o), ordAct(o)); }).join('') || empty('新しい取り置きはありません');
      var near = r.nearing.map(function (o) {
        return row(ordMain(o), linesTxt(o) + '<br><span class="st warn">受け取り日 ' + u.shortDate(o.pickupDate) + ' を ' + o.daysLate + '日過ぎ・あと' + Math.max(0, o.daysLeft) + '日で取り消し</span>', telBtn(o.customer && o.customer.phone));
      }).join('');

      return {
        body: nav + warn + sum +
          sec('受け取り', r.pickups.length, pick) +
          sec('サロンの予約', r.salon.length, salon, '<a class="ul sm" href="#/s/book">電話の予約を入れる</a>') +
          sec('採寸', r.measure.length, meas) +
          sec('発送する注文', r.ship.length, ship) +
          sec('新しい取り置き', r.fresh.length, fresh) +
          (near ? sec('受け取り日を過ぎたもの', r.nearing.length, near) : '') +
          (r.waitsNotified ? '<p class="t2s">入荷のお知らせを送って、まだ取り置きされていない方が ' + r.waitsNotified + '人います（24時間は優先）。</p>' : '') +
          '<details class="rules"><summary>この画面の決まり</summary><ul><li>取り置きは「用意済み」→ お客様が来たら「受け取り済み」。会計はこれまでどおりAirレジで。</li><li>受け取り日を過ぎると、前日・翌日にお知らせが届き、7日を過ぎると取り消して在庫に戻します。</li><li>発送する注文は、ネットで支払いが済んだものだけ出ます。</li></ul></details>'
      };
    });
  }

  /* ================= S02 カレンダー ================= */
  function cal(p) {
    var week = p.v === 'week', from = p.d || '';
    var args = { days: week ? 7 : 1 }; if (from) args.from = from;
    return page('cal', 'カレンダー', [['shopCalendar', args]], function (r) {
      var step = week ? 7 : 1, v = week ? '&v=week' : '';
      var head = '<div class="tabs"><a href="#/s/cal?d=' + r.from + '" class="' + (week ? '' : 'on') + '">日</a><a href="#/s/cal?v=week&d=' + r.from + '" class="' + (week ? 'on' : '') + '">週</a></div>' +
        '<div class="dnav"><a class="bbtn sm" href="#/s/cal?d=' + u.addDays(r.from, -step) + v + '" aria-label="前へ">' + ico('back') + '</a><b>' + u.jpDate(r.from) + (week ? '〜' + u.shortDate(u.addDays(r.from, 6)) : '') + '</b>' +
        '<a class="bbtn sm" href="#/s/cal?d=' + u.addDays(r.from, step) + v + '" aria-label="次へ">' + ico('next') + '</a><a class="ul" href="#/s/cal' + (week ? '?v=week' : '') + '">今日</a></div>';
      if (week) return head + weekList(r);
      var day = r.days[0];
      return head + dayGrid(r, day) +
        sec('採寸の枠', day.measureSlots.length, day.measureSlots.map(function (s) {
          return row('<span class="tm">' + u.hm(s.start) + '〜' + u.hm(s.end) + '</span>' + esc(s.school), '予約 ' + s.used + ' / 定員 ' + s.capacity + '組' + (s.used >= s.capacity ? '・埋まり' : ''));
        }).join('') || empty('この日の採寸の枠はありません')) +
        sec('受け取りの予定', null, '<p class="t2s">この日に受け取りの取り置きが <b>' + day.pickups + '</b> 件あります。<a class="ul" href="#/s?d=' + day.date + '">この日の一覧へ</a></p>') +
        '<div class="submitbar"><a class="bbtn pri" href="#/s/book">' + ico('plus') + '予約を入れる</a><a class="ul sm" href="#/s/book?t=block&d=' + day.date + '">席を押さえる</a></div>';
    });
  }
  function dayGrid(r, day) {
    var step = r.step, rows = (r.close - r.open) / step, seats = r.seats;
    var menus = {}; r.menus.forEach(function (m) { menus[m.id] = m; });
    var h = '<div class="cal scal" style="grid-template-columns:44px repeat(' + seats.length + ',1fr);grid-template-rows:28px repeat(' + rows + ',34px)">' +
      '<div class="hh"></div>' + seats.map(function (s) { return '<div class="hh">' + esc(s.name) + '</div>'; }).join('');
    for (var i = 0; i < rows; i++) {
      h += '<div class="tm" style="grid-column:1;grid-row:' + (i + 2) + '">' + (i % 2 === 0 ? u.hm(r.open + i * step) : '') + '</div>';
      for (var j = 0; j < seats.length; j++) h += '<div style="grid-column:' + (j + 2) + ';grid-row:' + (i + 2) + '"></div>';
    }
    function rowOf(min) { return Math.max(2, Math.min(rows + 2, (min - r.open) / step + 2)); }
    function colOf(id) { for (var k = 0; k < seats.length; k++) if (seats[k].id === id) return k + 2; return 2; }
    if (!day.open) {
      h += '<div class="b closed" style="grid-column:2/' + (seats.length + 2) + ';grid-row:2/' + (rows + 2) + '"><span>お休み（' + esc(day.why) + '）</span></div>';
    } else {
      day.blocks.forEach(function (b) {
        b.seatIds.forEach(function (sid) {
          h += '<a class="b blk" href="#/s/book?t=block&d=' + day.date + '" style="grid-column:' + colOf(sid) + ';grid-row:' + rowOf(b.start) + '/' + rowOf(b.end) + '">押さえ ' + esc(b.reason) + '</a>';
        });
      });
      day.salon.forEach(function (b) {
        var m = menus[b.menuId], prep = m ? Math.max(0, m.hold - m.mins) : 0;
        b.seatIds.forEach(function (sid) {
          var c = colOf(sid);
          h += '<a class="b' + (b.status === '来店済み' ? ' done' : '') + '" href="#/s/book/' + encodeURIComponent(b.id) + '?d=' + b.date + '" style="grid-column:' + c + ';grid-row:' + rowOf(b.start) + '/' + rowOf(b.end) + '">' +
            u.hm(b.start) + ' ' + esc(b.customer ? b.customer.name : '') + '<br><span class="mn">' + esc(b.menuName) + (b.status === '来店済み' ? '・来店済み' : '') + '</span></a>';
          if (prep) h += '<div class="b prep" style="grid-column:' + c + ';grid-row:' + rowOf(b.end) + '/' + rowOf(b.end + prep) + '">準備</div>';
        });
      });
    }
    return h + '</div><p class="t2s">予約を押すと、変更・取り消しの画面が開きます。予約のあとの「準備」は次の予約を入れない時間です。</p>';
  }
  function weekList(r) {
    return '<section class="card">' + r.days.map(function (d) {
      var sub;
      if (!d.open) sub = '<span class="st">お休み（' + esc(d.why) + '）</span>';
      else {
        var used = u.sum(d.measureSlots, function (s) { return s.used; }), cap = u.sum(d.measureSlots, function (s) { return s.capacity; });
        sub = 'サロン ' + d.salon.length + '件' + (d.salon.length ? '：' + d.salon.map(function (b) { return u.hm(b.start) + ' ' + esc(b.customer ? b.customer.name : ''); }).join('、') : '') +
          '<br>採寸 ' + (d.measureSlots.length ? used + ' / ' + cap + '組' : 'なし') + '・受け取り ' + d.pickups + '件' + (d.blocks.length ? '・席の押さえ ' + d.blocks.length + '件' : '');
      }
      return row('<a class="nm" href="#/s/cal?d=' + d.date + '">' + u.jpDate(d.date) + '</a>', sub, '<a class="bbtn sm" href="#/s/cal?d=' + d.date + '">' + ico('next') + '</a>', u.wd(d.date) === 6 ? 'sat' : '');
    }).join('') + '</section>';
  }

  /* ================= S03 予約を入れる・席の押さえ ================= */
  function book(p) {
    var blockTab = p.t === 'block';
    if (blockTab && p.d && st.blk._d !== p.d) { st.blk = { date: p.d, _d: p.d }; }
    var bk = st.bk, blk = st.blk;
    return page('book', '予約を入れる', function () {
      var date = blockTab ? blk.date : bk.date;
      return api('shopCalendar', date ? { from: date, days: 1 } : { days: 1 }).then(function (c) {
        if (!c.ok) return [c];
        if (blockTab) { if (!blk.date) blk.date = c.from; return [c]; }
        if (!bk.date) bk.date = c.from;
        bk._today = bk._today || c.from;
        if (!bk.menuId) return [c];
        return api('shopSalonSlots', { menuId: bk.menuId, date: bk.date }).then(function (s) { return [c, s]; });
      });
    }, function (c, s) {
      var tabs = '<div class="tabs"><a href="#/s/book" class="' + (blockTab ? '' : 'on') + '">サロンの予約</a><a href="#/s/book?t=block" class="' + (blockTab ? 'on' : '') + '">席を押さえる</a></div>';
      return tabs + (blockTab ? blockForm(c) : newForm(c, s));
    });
  }
  function slotGrid(s, sel, act) {
    if (!s) return '<p class="t2s">メニューを選ぶと、空いている時間が出ます。</p>';
    if (!s.ok) return '<div class="notice warn">' + esc(s.message) + '</div>';
    if (s.slots.length && s.slots.every(function (x) { return x.mark === '休'; })) return '<div class="notice">この日はお休みです（' + esc(s.slots[0].why) + '）。</div>';
    return '<div class="slots sslots">' + s.slots.map(function (x) {
      var cls = x.ok ? (sel === x.start ? 'sel' : '') : 'x';
      return '<button type="button" class="slot ' + cls + '"' + (x.ok ? ' data-act="' + act + '" data-t="' + x.start + '"' : ' disabled') + ' title="' + esc(x.why) + '">' + u.hm(x.start) + '<small>' + esc(x.mark) + '</small></button>';
    }).join('') + '</div><p class="legend">○ 2席とも空き　△ 残り1席　× 埋まり</p>';
  }
  function newForm(c, s) {
    var bk = st.bk, e = st.bkErr || {};
    var menus = c.menus.filter(function (m) { return m.visible !== false; });
    var m = menus.filter(function (x) { return x.id === bk.menuId; })[0];
    var doneMsg = st.bkDone ? '<div class="notice ok">予約を入れました：' + esc(st.bkDone.menuName) + '・' + u.jpDate(st.bkDone.date) + ' ' + u.hm(st.bkDone.start) + '　<a class="ul" href="#/s/cal?d=' + st.bkDone.date + '">カレンダーで見る</a>' +
      (st.bkDone.candidate ? '<br>同じ方かもしれないお客様がいます：<a class="ul" href="#/s/customers/' + encodeURIComponent(st.bkDone.candidate.id) + '">' + esc(st.bkDone.candidate.name) + ' 様</a>' : '') + '</div>' : '';
    var ready = m && bk.start != null && bk.start !== '';
    return doneMsg + '<div class="frm" id="bkf">' +
      sec('1. メニュー', null, ui.field('menuId', 'メニュー', { select: menus.map(function (x) { return { value: x.id, label: x.name + '（' + u.yen(x.price) + '）' }; }), value: bk.menuId, change: 'sBkMenu', err: e.menuId })) +
      sec('2. 日にちと時間', null, '<div class="field"><label>日にち</label><input class="inp" type="date" data-f="date" data-change="sBkDate" value="' + esc(bk.date) + '" min="' + esc(bk._today || '') + '"></div>' +
        '<div class="t2s">' + u.jpDate(bk.date) + '</div>' + slotGrid(s, bk.start == null ? null : +bk.start, 'sBkTime') + (e.slot ? '<div class="errtxt">' + esc(e.slot) + '</div>' : '')) +
      sec('3. お客様', null, '<div class="fgrid">' +
        ui.field('name', 'お名前', { req: true, value: bk.name, err: e.name, ac: 'off' }) +
        ui.field('phone', '電話番号', { req: true, type: 'tel', mode: 'tel', value: bk.phone, err: e.phone, help: '同じ電話番号の方は、同じお客様として記録します。' }) +
        ui.field('kana', 'フリガナ', { req: false, value: bk.kana }) +
        ui.field('email', 'メール', { req: false, type: 'email', mode: 'email', value: bk.email }) +
        ui.field('channel', '受けた方法', { select: ['電話', '店頭'], value: bk.channel || '電話', noBlank: true }) +
        ui.field('note', 'メモ', { req: false, textarea: true, value: bk.note, ph: '例：初めて。駐車場の場所を伝えた' }) + '</div>') +
      '</div>' +
      '<div class="submitbar"><span class="what">' + (m ? esc(m.name) + (ready ? '・' + u.shortDate(bk.date) + ' ' + u.hm(+bk.start) : '・時間を選んでください') : 'メニューを選んでください') + '</span>' +
      '<button type="button" class="bbtn pri" data-act="sBkSave"' + (ready ? '' : ' disabled') + '>予約を入れる</button></div>' +
      '<details class="rules"><summary>決まり</summary><ul><li>席は空いている方に自動で入ります。2名同時のメニューは2席とも使います。</li><li>店から入れる予約は、締め切り（2時間前）や受付の期間に関係なく入れられます。</li><li>店から入れた予約には、お客様へのお知らせは送りません。前日のお知らせはLINEかメールが分かる方にだけ届きます。</li></ul></details>';
  }
  function blockForm(c) {
    var blk = st.blk, day = c.days[0];
    var times = timeOpts(c.open, c.close, c.step);
    var seatOpts = [{ value: '', label: '両方の席' }].concat(c.seats.map(function (x) { return { value: x.id, label: x.name + 'だけ' }; }));
    var list = day.blocks.map(function (b) {
      return row('<span class="tm">' + u.hm(b.start) + '〜' + u.hm(b.end) + '</span>' + esc(b.reason), '席 ' + seatNames(b.seatIds), btn('外す', 'sBlkDel', { id: b.id }));
    }).join('') || empty('この日に押さえている席はありません');
    return '<div class="frm" id="blkf">' + sec('席を押さえる', null,
      '<p class="t2s">店の用事・点検などで、お客様の予約を入れたくない時間を押さえます。押さえた時間は、お客様の画面で「×」になります。</p>' +
      '<div class="fgrid"><div class="field"><label>日にち</label><input class="inp" type="date" data-f="date" data-change="sBlkDate" value="' + esc(blk.date) + '"></div>' +
      ui.field('seat', '席', { select: seatOpts, value: blk.seat || '', noBlank: true }) +
      ui.field('start', 'から', { select: times.slice(0, -1), value: blk.start || c.open, noBlank: true }) +
      ui.field('end', 'まで', { select: times.slice(1), value: blk.end || (c.open + 60), noBlank: true }) +
      ui.field('reason', '理由', { req: false, value: blk.reason, ph: '例：点検、店の用事' }) + '</div>' +
      (day.open ? '' : '<div class="notice">この日はお休みです（' + esc(day.why) + '）。</div>')) + '</div>' +
      sec(u.jpDate(day.date) + 'に押さえている席', day.blocks.length, list) +
      '<div class="submitbar"><span class="what">' + u.shortDate(blk.date) + '</span><button type="button" class="bbtn pri" data-act="sBlkAdd">席を押さえる</button></div>';
  }

  /* S03 予約を変える・取り消す */
  function bookEdit(id, p) {
    var mv = st.mv;
    if (mv.id !== id) st.mv = mv = { id: id, open: '' };
    return page('book', '予約を変える', function () {
      return api('shopSalon', { id: id }).then(function (c) {
        if (!c.ok) return [c];
        var b = c.booking;
        if (!b || !mv.date) return [c];
        return api('shopSalonSlots', { menuId: b.menuId, date: mv.date, ignoreId: id }).then(function (s) { return [c, s]; });
      });
    }, function (c, s) {
      var b = c.booking;
      if (!b) return '<div class="notice">予約が見つかりません。</div><p><a class="ul" href="#/s/cal">カレンダーへ</a></p>';
      var cu = b.customer || {};
      var info = '<table class="sumtable">' +
        '<tr><td>日時</td><td>' + u.jpDate(b.date) + ' ' + tm(b) + '</td></tr>' +
        '<tr><td>メニュー</td><td>' + esc(b.menuName) + '（' + u.yen(b.price) + '）・席 ' + seatNames(b.seatIds) + '</td></tr>' +
        '<tr><td>お客様</td><td>' + clink(cu) + (b.party > 1 ? ' ほか1名' : '') + '<div class="t2s">' + esc(telFmt(cu.phone)) + (cu.line ? '・LINEでつながっている' : cu.email ? '・メール ' + esc(cu.email) : '') + '</div></td></tr>' +
        '<tr><td>状態</td><td>' + esc(b.status) + '</td></tr>' +
        '<tr><td>受付</td><td>' + esc(b.channel) + '・' + esc(b.createdAt || '') + '</td></tr>' +
        (b.note ? '<tr><td>メモ</td><td>' + esc(b.note) + '</td></tr>' : '') + '</table>';
      var live = b.status === '予約';
      var main = live ? '<div class="submitbar"><span class="what">お客様が来たら</span>' + btn('来店済みにする', 'sSal', { id: b.id, s: '来店済み' }, 'pri') + telBtn(cu.phone) + '</div>' : '';
      var reach = cu.line || cu.email;
      var move = live ? '<details class="rules frm" ' + (mv.open === 'move' ? 'open' : '') + ' data-open="move"><summary>日時を変える</summary>' +
        '<div class="field"><label>日にち</label><input class="inp" type="date" data-f="mvdate" data-change="sMvDate" value="' + esc(mv.date || '') + '"></div>' +
        (mv.date ? slotGrid(s, mv.start == null ? null : +mv.start, 'sMvTime') : '<p class="t2s">日にちを選ぶと、空いている時間が出ます。</p>') +
        check('notify', 'お客様に変更を知らせる（LINEかメール）', reach) +
        '<div class="row-r">' + btn('この日時に変える', 'sMove', { id: b.id }, mv.start != null ? 'pri' : '') + '</div></details>' : '';
      var cancel = live ? '<details class="rules frm"><summary>取り消す・無断キャンセル</summary>' +
        ui.field('kind', 'どうしたか', { select: [{ value: '取り消し（お客様）', label: 'お客様から取り消しの連絡' }, { value: '取り消し（店）', label: '店の都合で取り消す' }, { value: '無断キャンセル', label: '連絡なしで来なかった（無断）' }], noBlank: true }) +
        ui.field('reason', '理由（記録に残す）', { req: false, ph: '例：体調不良のため' }) +
        check('notify', 'お客様に取り消しを知らせる（無断のときは送りません）', false) +
        '<div class="row-r">' + btn('取り消す', 'sCancel', { id: b.id, d: b.date }) + '</div></details>' : '';
      var note = '<details class="rules frm"><summary>メモを残す</summary>' + ui.field('note', 'メモ', { textarea: true, value: b.note, req: false }) + '<div class="row-r">' + btn('メモを残す', 'sSalNote', { id: b.id }) + '</div></details>';
      var hist = (c.history && c.history.length) || (c.notices && c.notices.length) ? '<details class="rules"><summary>これまでの記録と送ったお知らせ</summary><ul class="hist">' +
        (c.history || []).map(function (x) { return '<li>' + esc(x.at) + '　' + esc(x.who) + '：' + esc(x.action) + '</li>'; }).join('') +
        (c.notices || []).map(function (n) { return '<li>' + esc(n.at) + '　' + esc(n.kind) + '（' + esc(n.channel) + '・' + esc(n.status) + '）</li>'; }).join('') + '</ul></details>' : '';
      return info + main + move + cancel + note + hist + '<p><a class="ul" href="#/s/cal?d=' + b.date + '">カレンダーへ戻る</a></p>';
    });
  }
  function check(id, label, on) { return '<label class="chk"><input type="checkbox" data-f="' + id + '"' + (on ? ' checked' : '') + '><span>' + esc(label) + '</span></label>'; }

  /* ================= S04 取り置き・注文 ================= */
  var OF = ['進行中', '受付', '用意済み', '支払い待ち', '受け取り済み', '発送済み', '取り消し', 'すべて'];
  function orders(p) {
    var f = OF.indexOf(p.f) >= 0 ? p.f : '進行中';
    return page('orders', '取り置き・注文', [['shopOrders', { filter: f }]], function (r) {
      var c = r.counts || {};
      var cnt = function (k) { if (k === 'すべて') return u.sum(Object.keys(c), function (x) { return c[x]; }); if (k === '進行中') return (c['受付'] || 0) + (c['用意済み'] || 0) + (c['支払い待ち'] || 0); return c[k] || 0; };
      var tabs = '<div class="tabs xs">' + OF.map(function (k) { if (k === '支払い待ち' && !c[k]) return ''; return '<a href="#/s/orders?f=' + encodeURIComponent(k) + '" class="' + (k === f ? 'on' : '') + '">' + k + ' <span class="cnt">' + cnt(k) + '</span></a>'; }).join('') + '</div>';
      var list = r.rows.map(function (o) {
        return row(ordMain(o, '<span class="t2s">' + recvTxt(o) + '</span>'), linesTxt(o) + '<br>' + u.yen(o.total) + '・' + payTxt(o) + '・' + esc(o.channel) + '<span class="t3">　' + esc(String(o.createdAt).slice(5)) + '</span>', ordAct(o));
      }).join('') || empty(f === '進行中' ? '進行中の取り置きはありません' : '「' + f + '」の取り置きはありません');
      return tabs + '<section class="card">' + list + '</section>';
    });
  }
  function orderDetail(id) {
    return page('orders', '取り置き・注文', [['shopOrder', { id: id }]], function (r) {
      var o = r.order, cu = o.customer || {};
      var lines = '<table class="t mini"><tr><th>品物</th><th class="n">数</th><th class="n">金額</th></tr>' + o.lines.map(function (l) { return '<tr><td>' + esc(l.label) + '</td><td class="n">' + l.qty + '</td><td class="n">' + u.yen(l.price * l.qty) + '</td></tr>'; }).join('') +
        (o.shipFee ? '<tr><td>送料</td><td></td><td class="n">' + u.yen(o.shipFee) + '</td></tr>' : '') + '<tr><td>合計</td><td></td><td class="n">' + u.yen(o.total) + '</td></tr></table>';
      var recv = o.method === '配送' ? '配送（' + esc(o.ship.method) + '）<div class="t2s">〒' + esc(o.ship.zip) + ' ' + esc(o.ship.addr) + '　' + esc(o.ship.to) + ' 様' + (o.ship.tracking ? '<br>問い合わせ番号 ' + esc(o.ship.tracking) : '') + '</div>'
        : '店頭・' + (o.pickupDate ? u.jpDate(o.pickupDate) : '') + (o.keepUntil && (o.status === '受付' || o.status === '用意済み') ? '<div class="t2s">' + u.shortDate(o.keepUntil) + ' までに来なければ取り消し</div>' : '');
      var info = '<table class="sumtable">' +
        '<tr><td>状態</td><td>' + esc(o.status) + (o.cancelReason ? '<div class="t2s">' + esc(o.cancelReason) + '</div>' : '') + '</td></tr>' +
        '<tr><td>受け取り</td><td>' + recv + '</td></tr>' +
        '<tr><td>支払い</td><td>' + payTxt(o) + '</td></tr>' +
        '<tr><td>お客様</td><td>' + clink(cu) + '<div class="t2s">' + esc(telFmt(cu.phone)) + (cu.line ? '・LINEでつながっている' : '') + (cu.email ? '・' + esc(cu.email) : '') + (cu.blocked ? '・LINEはブロック中' : '') + '</div></td></tr>' +
        '<tr><td>受付</td><td>' + esc(o.createdAt) + '・' + esc(o.channel) + (o.utm && o.utm.source ? '（' + esc(o.utm.source) + 'から）' : '') + '</td></tr></table>';
      /* いま押すボタン（1つ） */
      var main = '';
      if (o.status === '受付' && o.method === '店頭') main = '<span class="what">品物をそろえたら</span>' + btn('用意済みにする', 'sOrd', { id: o.id, s: '用意済み' }, 'pri');
      else if (o.status === '用意済み') main = '<span class="what">お客様が受け取ったら</span>' + btn('受け取り済みにする', 'sOrd', { id: o.id, s: '受け取り済み' }, 'pri');
      else if (o.status === '受付' && o.method === '配送') main = '<div class="frm grow">' + ui.field('tracking', '問い合わせ番号（あれば）', { req: false, mode: 'numeric' }) + '</div>' + btn('発送済みにする', 'sOrd', { id: o.id, s: '発送済み' }, 'pri');
      var live = o.status === '受付' || o.status === '用意済み' || o.status === '支払い待ち';
      var more = '';
      if (live && o.method === '店頭') more += '<details class="rules frm"><summary>受け取り日を変える</summary><div class="field"><label>新しい受け取り日</label><input class="inp" type="date" data-f="pdate" value="' + esc(o.pickupDate || '') + '"></div><div class="row-r">' + btn('受け取り日を変える', 'sOrd', { id: o.id, s: 'pickupDate' }) + '</div></details>';
      if (live) more += '<details class="rules frm"><summary>取り消す</summary>' + ui.field('reason', '理由', { req: false, ph: '例：お客様から電話。サイズ違い' }) + check('notify', 'お客様に取り消しを知らせる', true) +
        '<p class="t2s">取り消すと、品物は在庫に戻ります。' + (o.payStatus === '支払い済み' ? 'ネットで払われているので、Squareで返金してから「返金済み」にしてください。' : '') + '</p><div class="row-r">' + btn('取り消す', 'sOrd', { id: o.id, s: '取り消し' }) + '</div></details>';
      if (o.payStatus === '返金待ち') main = '<span class="what">Squareで返金したら</span>' + btn('返金済みにする', 'sOrd', { id: o.id, s: '返金済み' }, 'pri');
      if (o.status === '受付' && o.method === '店頭') more += '<details class="rules frm"><summary>用意せずに受け取り済みにする</summary><p class="t2s">その場でお渡ししたときに。</p><div class="row-r">' + btn('受け取り済みにする', 'sOrd', { id: o.id, s: '受け取り済み' }) + '</div></details>';
      more += '<details class="rules frm"><summary>メモ' + (o.note ? '（あり）' : '') + '</summary>' + ui.field('note', 'メモ', { textarea: true, value: o.note, req: false }) + '<div class="row-r">' + btn('メモを残す', 'sOrd', { id: o.id, s: 'note' }) + '</div></details>';
      var hist = r.history.slice().reverse().map(function (a) { return row(esc(a.action), esc(a.at) + '・' + esc(a.who)); }).join('') || empty('記録はありません');
      var nts = r.notices.slice().reverse().map(function (n) { return noticeRow(n, true); }).join('') || empty('送ったお知らせはありません');
      return {
        title: '受付 ' + o.id,
        body: '<p><a class="ul" href="#/s/orders">' + ico('back') + '一覧へ</a></p>' + info + (main ? '<div class="submitbar">' + main + '</div>' : '') +
          sec('品物', null, lines) + more + sec('送ったお知らせ', r.notices.length, nts) + sec('これまでの記録', r.history.length, hist)
      };
    });
  }

  /* ================= S05 在庫と入荷 ================= */
  function stock(p) {
    var waitsTab = p.t === 'waits', sid = p.school || '';
    if (waitsTab) return waitsPage(p);
    return page('stock', '在庫と入荷', [['shopStock', sid ? { schoolId: sid } : {}]], function (r) {
      var S = st.stock;
      var tabs = '<div class="tabs"><a href="#/s/stock" class="on">在庫</a><a href="#/s/stock?t=waits">入荷待ち</a></div>';
      var filt = '<div class="frm">' + ui.field('school', '学校', { select: [{ value: '', label: 'すべての学校' }].concat(r.schools.map(function (s) { return { value: s.id, label: s.short }; })).concat([{ value: 'common', label: '共通の品' }]), value: sid, noBlank: true, change: 'sStkSchool' }) + '</div>';
      var cur = null;
      var cards = r.rows.map(function (pr) {
        var p0 = pr.product;
        var pv = pr.price && pr.price.varies;
        var trs = pr.sizes.map(function (z) {
          var on = S.sel && S.sel.pid === p0.id && S.sel.size === z.size;
          if (on) cur = { p: p0, z: z, school: pr.school };
          return '<tr class="' + (on ? 'sel' : '') + '" data-act="sStkPick" data-pid="' + esc(p0.id) + '" data-size="' + esc(z.size) + '" data-label="' + esc(pr.school + ' ' + p0.name + '（' + (z.label || z.size) + '）') + '">' +
            '<td>' + esc(z.label || z.size) + '</td>' + (pv ? '<td class="n">' + u.yen(z.price) + '</td>' : '') + '<td class="n">' + z.qty + '</td><td class="n">' + (z.held || '<span class="t3">0</span>') + '</td><td class="n">' + (z.free ? z.free : '<span class="st warn">0</span>') + '</td><td class="n">' + (z.waiting ? '<b>' + z.waiting + '</b>人' : '<span class="t3">—</span>') + '</td></tr>';
        }).join('');
        return '<section class="card pcard"><div class="h2r"><h2>' + esc(pr.school) + ' ' + esc(p0.name) + '</h2><span class="t2s">' + priceText(pr.price, p0.price) + (p0.priceTentative ? '（仮）' : '') + (p0.visible ? '' : '・見せていない') + '</span></div>' +
          '<table class="t mini stk"><tr><th>サイズ</th>' + (pv ? '<th class="n">価格</th>' : '') + '<th class="n">数</th><th class="n">押さえ中</th><th class="n">残り</th><th class="n">待っている人</th></tr>' + trs + '</table></section>';
      }).join('') || empty('品物がありません');
      var q = r.quota;
      return {
        sub: 'LINEの残り ' + q.left + '通',
        body: tabs + editor(cur, q) + filt + '<p class="t2s">サイズの行を押すと、入荷を入れたり数を直したりできます。</p>' + cards +
          '<details class="rules"><summary>数の見方</summary><ul><li>数：店にある数。取り置きを受けると減り、取り消すと戻ります。</li><li>押さえ中：お客様がかごに入れている分と、入荷のお知らせで24時間優先している分。</li><li>残り：ほかのお客様が取れる数（数 − 押さえ中）。お客様には「あり／残りわずか／品切れ」とだけ見せます。</li><li>待っている人：入荷のお知らせを待っている人。入荷を入れると、早い順に入荷の数だけ知らせます。</li></ul></details>'
      };
    });
  }
  function editor(cur, q) {
    var S = st.stock;
    if (!S.sel) return '';
    var lab = esc(S.sel.label);
    var tabs = '<div class="tabs"><a href="#" data-act="sStkMode" data-m="in" class="' + (S.mode === 'in' ? 'on' : '') + '">入荷を入れる</a><a href="#" data-act="sStkMode" data-m="set" class="' + (S.mode === 'set' ? 'on' : '') + '">数を直す</a></div>';
    var now = cur ? '<p class="t2s">いま 数 ' + cur.z.qty + '・残り ' + cur.z.free + '・待っている人 ' + cur.z.waiting + '人</p>' : '';
    var body;
    if (S.mode === 'set') {
      body = '<div class="frm" id="stkf">' + ui.field('qty', '店にある数（数え直した数）', { type: 'number', mode: 'numeric', value: S.qty !== '' ? S.qty : (cur ? cur.z.qty : '') }) +
        '<p class="t2s">棚卸しで数を合わせるときに使います。お客様へのお知らせは送りません。</p><div class="row-r">' + btn('数を直す', 'sStkSet', {}, 'pri') + '</div></div>';
    } else {
      var pv = S.pv;
      var pvHtml = pv ? '<div class="pv"><div>待っている人<b>' + pv.waiting + '</b>人</div><div>今回知らせる<b>' + pv.willNotify + '</b>人<span class="t2s">（LINE ' + pv.lineCount + '・メール ' + pv.mailCount + '）</span></div><div>今月のLINEの残り<b>' + pv.quota.left + '</b>通</div></div>' +
        (pv.lineCount > pv.quota.left ? '<div class="notice ng">LINEの残りが足りません。足りない分は送れずに「未送信」になります。</div>' : '') +
        check('nonotify', 'お知らせは送らずに、数だけ足す', !S.notify) : '';
      body = '<div class="frm" id="stkf">' + ui.field('qty', '入荷した数', { type: 'number', mode: 'numeric', value: S.qty, change: '', ph: '例：5' }) + pvHtml +
        '<div class="row-r">' + (pv ? btn('やり直す', 'sStkReset') + btn(pv.willNotify ? '入荷を入れて知らせる' : '入荷を入れる', 'sStkSend', {}, 'pri') : btn('知らせる人を確かめる', 'sStkPreview', {}, 'pri')) + '</div></div>';
    }
    return '<section class="card sedit" id="sedit"><div class="h2r"><h2>' + lab + '</h2>' + btn('閉じる', 'sStkClose') + '</div>' + now + tabs + body + '</section>';
  }
  function waitsPage(p) {
    var f = p.f || '待ち';
    return page('stock', '在庫と入荷', [['shopWaits', {}]], function (r) {
      var F = ['待ち', 'お知らせ済み', '予約済み', 'すべて'];
      var cnt = function (k) { return k === 'すべて' ? r.rows.length : r.rows.filter(function (w) { return w.status === k; }).length; };
      var rows = r.rows.filter(function (w) { return f === 'すべて' || w.status === f; });
      var tabs = '<div class="tabs"><a href="#/s/stock">在庫</a><a href="#/s/stock?t=waits" class="on">入荷待ち</a></div>' +
        '<div class="tabs xs">' + F.map(function (k) { return '<a href="#/s/stock?t=waits&f=' + encodeURIComponent(k) + '" class="' + (k === f ? 'on' : '') + '">' + k + ' <span class="cnt">' + cnt(k) + '</span></a>'; }).join('') + '</div>';
      var list = rows.map(function (w) {
        var sub = '登録 ' + esc(String(w.createdAt).slice(5)) + '・' + esc(w.channel) + (w.notifiedAt ? '・お知らせ ' + esc(String(w.notifiedAt).slice(5)) : '') + (w.endReason ? '・' + esc(w.endReason) : '');
        return row(esc(w.label) + '<span class="t2s">' + clink(w.customer) + '</span>', sub, '<span class="st">' + esc(w.status) + '</span>');
      }).join('') || empty('「' + f + '」の方はいません');
      return tabs + '<section class="card">' + list + '</section>';
    });
  }

  /* ================= S06 お客様台帳 ================= */
  function customers(p) {
    var q = p.q || '';
    return page('customers', 'お客様', [['shopCustomers', { q: q }]], function (r) {
      var search = '<div class="frm sbox"><input class="inp" id="cq" data-f="q" type="search" value="' + esc(q) + '" placeholder="名前・カナ・電話・メールで探す">' + btn(ico('search') + '探す', 'sCusFind', {}, 'pri') + '</div>';
      var list = r.rows.map(function (x) {
        var sub = [esc(telFmt(x.phone)), x.school ? esc(x.school) : '', x.line ? 'LINE' : (x.email ? 'メール' : ''), '取り置き ' + x.orders + '件', 'サロン ' + x.salon + '回', x.last ? '最後 ' + u.shortDate(x.last) : ''].filter(Boolean).join('・');
        return row('<a class="nm" href="#/s/customers/' + encodeURIComponent(x.id) + '">' + esc(x.name) + ' 様</a>' + (x.kana ? '<span class="t2s">' + esc(x.kana) + '</span>' : '') + (x.memo && x.memo.indexOf('同じ方かもしれない') === 0 ? '<span class="st warn">同じ方かも</span>' : ''), sub);
      }).join('') || empty(q ? '「' + q + '」に当てはまる方はいません' : 'まだお客様はいません');
      return { sub: '全' + r.total + '人', body: search + (q ? '<p class="t2s">' + r.rows.length + '人見つかりました　<a class="ul" href="#/s/customers">検索をやめる</a></p>' : '') + '<section class="card">' + list + '</section>' };
    });
  }
  function custDetail(id) {
    return page('customers', 'お客様', [['shopCustomer', { id: id }]], function (r) {
      var x = r.customer;
      if (x.mergedInto) return '<div class="notice">この方は <a class="ul" href="#/s/customers/' + encodeURIComponent(x.mergedInto) + '">別のお客様</a> にまとめました。</div>';
      var cand = /同じ方かもしれない：(\S+)/.exec(x.memo || '');
      var info = '<table class="sumtable">' +
        '<tr><td>電話</td><td>' + (x.phone ? '<a class="ul" href="tel:' + esc(x.phone) + '">' + esc(telFmt(x.phone)) + '</a>' : '<span class="t3">なし</span>') + '</td></tr>' +
        '<tr><td>連絡</td><td>' + (x.lineUserId ? 'LINE' + (x.blocked ? '（ブロック中）' : '') : '') + (x.email ? (x.lineUserId ? '・' : '') + 'メール ' + esc(x.email) : '') + (!x.lineUserId && !x.email ? '<span class="t3">電話だけ</span>' : '') + '</td></tr>' +
        '<tr><td>どこで知ったか</td><td>' + esc(x.heardFrom || '—') + (x.firstSource ? '<span class="t2s">（最初の入口：' + esc(x.firstSource) + '）</span>' : '') + '</td></tr>' +
        '<tr><td>はじめて</td><td>' + esc(x.createdAt || '') + '</td></tr></table>' +
        (cand ? '<div class="notice warn">同じ方かもしれないお客様がいます：<a class="ul" href="#/s/customers/' + encodeURIComponent(cand[1]) + '">' + esc(cand[1]) + '</a>。同じ方なら、下の「同じ方をまとめる」で1人にします。</div>' : '');
      var memo = '<div class="frm" id="cmf">' + ui.field('memo', 'メモ', { textarea: true, value: x.memo, req: false, ph: '例：上の子は神栖二中。サイズはMが合う' }) + '<div class="row-r">' + btn('メモを残す', 'sCusSave', { id: x.id }) + '</div></div>';
      var edit = '<details class="rules frm" id="cef"><summary>お名前・電話を直す</summary><div class="fgrid">' + ui.field('name', 'お名前', { value: x.name }) + ui.field('kana', 'フリガナ', { value: x.kana, req: false }) + ui.field('phone', '電話', { value: x.phone, type: 'tel', mode: 'tel', req: false }) + '</div><div class="row-r">' + btn('直す', 'sCusEdit', { id: x.id }) + '</div></details>';
      var M = st.merge && st.merge.forId === x.id ? st.merge : null;
      var merge = '<details class="rules frm" ' + (M ? 'open' : '') + '><summary>同じ方をまとめる</summary><p class="t2s">電話とLINEで別々に登録された同じ方を1人にします。この方の取り置き・予約・お知らせの記録を、選んだ方に移します。元には戻せません。</p>' +
        '<div class="sbox"><input class="inp" id="mq" data-f="mq" type="search" value="' + esc(M ? M.q : (cand ? cand[1] : '')) + '" placeholder="名前・電話で探す">' + btn('探す', 'sMergeFind', { id: x.id }) + '</div>' +
        (M ? (M.rows.length ? M.rows.map(function (y) { return row(esc(y.name) + ' 様<span class="t2s">' + esc(y.id) + '</span>', esc(telFmt(y.phone)) + (y.line ? '・LINE' : '') + '・取り置き ' + y.orders + '件・サロン ' + y.salon + '回', btn('この方にまとめる', 'sMergeTo', { id: x.id, to: y.id })); }).join('') : empty('見つかりません')) : '') + '</details>';
      var ord = r.orders.map(function (o) { return row(ordMain(o, '<span class="t2s">' + recvTxt(o) + '</span>'), linesTxt(o) + '・' + u.yen(o.total), '<span class="st">' + esc(o.status) + '</span>'); }).join('') || empty('取り置きはありません');
      var sal = r.salon.map(function (b) { return row('<a class="nm" href="#/s/book/' + encodeURIComponent(b.id) + '?d=' + b.date + '">' + u.shortDate(b.date) + ' ' + u.hm(b.start) + '</a>', esc(b.menuName) + '・' + esc(b.channel), '<span class="st">' + esc(b.status) + '</span>'); }).join('') || empty('サロンの予約はありません');
      var mea = r.measure.map(function (b) { return row(u.shortDate(b.date) + ' ' + tm(b), esc(b.school) + '・' + b.count + '人（' + esc(b.children) + '）', '<span class="st">' + esc(b.status) + '</span>'); }).join('') || empty('採寸の予約はありません');
      var wt = r.waits.map(function (w) { return row(esc(w.label), '登録 ' + esc(String(w.createdAt).slice(5)), '<span class="st">' + esc(w.status) + '</span>'); }).join('') || empty('入荷待ちはありません');
      var nt = r.notices.map(function (n) { return noticeRow(n, true); }).join('') || empty('お知らせはありません');
      var rv = r.reviews.map(function (v) { return row(v.stars + '点<span class="t2s">' + esc(v.date || String(v.at).slice(0, 10)) + '</span>', (v.text ? esc(v.text) : '<span class="t3">ひとことなし</span>') + (v.toShop ? '<br>お店へ：' + esc(v.toShop) : '')); }).join('') || empty('声はまだありません');
      return {
        title: x.name ? x.name + ' 様' : 'お客様',
        sub: esc(x.kana || ''),
        body: '<p><a class="ul" href="#/s/customers">' + ico('back') + '一覧へ</a></p>' + info + memo + edit +
          sec('取り置き・注文', r.orders.length, ord) + sec('サロン', r.salon.length, sal) + sec('採寸', r.measure.length, mea) + sec('入荷待ち', r.waits.length, wt) +
          sec('送ったお知らせ', r.notices.length, nt) + sec('声', r.reviews.length, rv) + merge
      };
    });
  }

  /* ================= S07 お知らせの記録 ================= */
  function noticeRow(n, brief) {
    var bad = n.status === '未送信' || n.status === '止めた';
    var how = n.channel === 'LINE' ? 'LINE' + (n.mode === 'reply' ? '（返信・通数0）' : '（1通）') : esc(n.channel);
    var main = esc(n.kind) + '<span class="t2s">' + esc(String(n.at).slice(5)) + '・' + how + '</span>' + (!brief && n.customerId ? '<a class="ul sm" href="#/s/customers/' + encodeURIComponent(n.customerId) + '">' + esc(n.customerName || 'お客様') + '</a>' : '');
    var sub = (bad ? '<span class="st warn">' + esc(n.status) + '：' + esc(n.error || '') + '</span>' : '') + (n.text ? '<details class="txt"><summary>送った文を見る</summary><div>' + ui.br(n.text) + '</div></details>' : '');
    return row(main, sub, bad ? '' : '<span class="st">' + esc(n.status) + '</span>', bad ? 'bad' : '');
  }
  function notices(p) {
    var ng = p.ng === '1';
    return page('notices', 'お知らせの記録', [['shopNotices', p.m ? { month: p.m } : {}]], function (r) {
      var q = r.quota, m = r.month;
      var big = '<section class="card qbox"><div class="l">今月のLINEの残り</div><div class="big">' + q.left + '<small>通</small></div>' +
        '<div class="t2s">無料の ' + q.quota + '通のうち ' + q.used + '通を使いました。' + q.stopUnder + '通を切ると、前日のお知らせを止めます。</div>' +
        '<div class="meter"><i style="width:' + Math.min(100, Math.round(q.used / Math.max(1, q.quota) * 100)) + '%"></i></div></section>' +
        (q.left < q.stopUnder ? '<div class="notice ng">残りが ' + q.stopUnder + '通を切りました。前日のお知らせを止めています（受付の確認は返信なので届きます）。</div>' : '');
      var nav = '<div class="dnav"><a class="bbtn sm" href="#/s/notices?m=' + addMonth(m, -1) + '" aria-label="前の月">' + ico('back') + '</a><b>' + mlabel(m) + '</b><a class="bbtn sm" href="#/s/notices?m=' + addMonth(m, 1) + '" aria-label="次の月">' + ico('next') + '</a>' + (p.m ? '<a class="ul" href="#/s/notices">今月</a>' : '') + '</div>';
      var kinds = r.byKind.length ? '<table class="t mini"><tr><th>種類</th><th class="n">LINE</th><th class="n">うち通数</th><th class="n">メール</th><th class="n">送れず</th></tr>' +
        r.byKind.map(function (k) { return '<tr><td>' + esc(k.kind) + '</td><td class="n">' + k.line + '</td><td class="n">' + k.push + '</td><td class="n">' + k.mail + '</td><td class="n">' + (k.failed ? '<span class="st warn">' + k.failed + '</span>' : '0') + '</td></tr>'; }).join('') + '</table>' : empty('この月のお知らせはありません');
      var bad = r.rows.filter(function (n) { return n.status === '未送信' || n.status === '止めた'; }).length;
      var rows = r.rows.filter(function (n) { return !ng || n.status === '未送信' || n.status === '止めた'; });
      var tabs = '<div class="tabs xs"><a href="#/s/notices?m=' + m + '" class="' + (ng ? '' : 'on') + '">すべて <span class="cnt">' + r.rows.length + '</span></a><a href="#/s/notices?m=' + m + '&ng=1" class="' + (ng ? 'on' : '') + '">送れなかったもの <span class="cnt">' + bad + '</span></a></div>';
      return big + nav + sec('種類ごと', null, kinds) + tabs + '<section class="card">' + (rows.map(function (n) { return noticeRow(n); }).join('') || empty(ng ? '送れなかったお知らせはありません' : 'この月のお知らせはありません')) + '</section>' +
        '<details class="rules"><summary>通数の数え方</summary><ul><li>お客様が操作した直後の確認（受付・取り消し）は「返信」で送るので、通数を使いません。</li><li>前日・入荷・発送などは1人に1通ずつ数えます。無料は月200通。</li><li>LINEでつながっていない方には、メールで送ります（通数に入りません）。</li><li>「止めた」「未送信」の方には、必要なら電話で知らせてください。</li></ul></details>';
    });
  }

  /* ================= そのほか ================= */
  function more() {
    return page('more', 'そのほか', [['shopNotices', {}]], function (r) {
      var items = [['book', 'plus', '予約を入れる・席を押さえる', '電話・店頭のサロン予約、店の用事で席を押さえる'], ['customers', 'user', 'お客様', '取り置き・予約・お知らせの履歴、メモ'], ['notices', 'bell', 'お知らせの記録', '今月のLINEの残り ' + r.quota.left + '通'], ['settings', 'gear', '設定', '営業日・臨時休業・品物と価格・採寸の枠・文面']];
      return '<nav class="mlist card">' + items.map(function (x) { return '<a href="#/s/' + x[0] + '">' + ico(x[1]) + '<span>' + x[2] + '<small>' + esc(x[3]) + '</small></span>' + ico('next', 'chev') + '</a>'; }).join('') +
        '<a href="#/b">' + ico('chart') + '<span>運営ボード<small>集客・予約・売上の数字</small></span>' + ico('next', 'chev') + '</a></nav>' +
        '<p><button type="button" class="linkbtn" data-act="sLogout">店の画面から出る</button></p>';
    });
  }

  /* ================= S08 設定 ================= */
  var SETS = [
    ['shop', '店の情報', '名前・住所・電話・営業時間の書き方'], ['days', '営業日と臨時休業', '曜日・開店と閉店・臨時休業の日'], ['schools', '学校', '学校の名前・採寸の予約を受けるか'],
    ['products', '品物と価格', '品名・価格・サイズごとの価格・見せるか'], ['campaign', 'お買い上げプレゼントの案内', '小学校の体操服のプレゼントと子育て応援券の文・出すか'], ['measure', '採寸の枠', '学校・日にち・時間・定員'], ['menus', 'サロンのメニュー', '時間・料金・使う席'],
    ['templates', 'お知らせの文', 'LINEとメールで送る文'], ['legal', '決まり', '特定商取引法の表示・プライバシー・キャンセル'], ['nums', '数の決まり', '受け取りの期限・締め切り・通数'],
    ['stages', 'お客様に見せるもの', '取り置き・採寸・配送・サロンなどを出すか'], ['members', '店の人', '店の画面に入れるGoogleアカウント'], ['audit', '操作の記録', 'だれが・いつ・何をしたか']
  ];
  function settings(sec0, p) {
    if (!sec0) {
      return page('settings', '設定', [['shopSettings', {}]], function (r) {
        st.set = r;
        return '<nav class="mlist card">' + SETS.map(function (x) { return '<a href="#/s/settings/' + x[0] + '"><span>' + x[1] + '<small>' + x[2] + '</small></span>' + ico('next', 'chev') + '</a>'; }).join('') + '</nav>' +
          (r.cfg.sampleData ? '<p class="t2s">いまは見本のデータが入っています。</p>' : '');
      });
    }
    var def = SETS.filter(function (x) { return x[0] === sec0; })[0];
    if (!def) return settings('', p);
    var calls = [['shopSettings', {}]];
    if (sec0 === 'audit') calls.push(['shopAudit', {}]);
    return page('settings', def[1], calls, function (r, a) {
      st.set = r;
      var back = '<p><a class="ul" href="#/s/settings">' + ico('back') + '設定へ</a></p>';
      return back + SEC[sec0](r, a, p);
    });
  }
  function saveBar(act, label, data) { return '<div class="submitbar"><span class="what">変えたら保存してください</span>' + btn(label || '保存する', act, data, 'pri') + '</div>'; }

  var SHOP_F = [['name', '店の名前'], ['address', '住所'], ['tel', '電話'], ['hours', '営業時間（お客様に見せる書き方）'], ['closedText', '定休日（書き方）'], ['instagram', 'Instagram のリンク'], ['map', '地図のリンク'], ['lineAddUrl', '公式LINEの友だち追加のリンク'], ['airReserve', 'Airリザーブのリンク（サロンを切り替えるまで）'], ['googleReviewUrl', 'Googleのクチコミのリンク'], ['owner', '運営責任者'], ['manager', '店長']];
  var TPL = [['order_received', '取り置きの受付'], ['order_paid', '支払いの確認'], ['order_dayBefore', '取り置きの前日'], ['order_noShow', '受け取り日を過ぎたとき'], ['order_cancelled', '取り置きの取り消し'], ['order_shipped', '発送'], ['restock', '入荷'],
    ['measure_received', '採寸の受付'], ['measure_dayBefore', '採寸の前日'], ['salon_received', 'サロンの受付'], ['salon_changed', 'サロンの日時の変更'], ['salon_cancelled', 'サロンの取り消し'], ['salon_dayBefore', 'サロンの前日']];
  var NUMS = [['pickup', 'fromDays', '受け取り日：何日後から選べるか', '日'], ['pickup', 'toDays', '受け取り日：何日後まで選べるか', '日'], ['pickup', 'keepDays', '受け取り日を過ぎて取り消すまで', '日'],
    ['cart', 'holdMin', 'かごに入れた品を押さえる時間', '分'], ['cart', 'lowStock', '「残りわずか」と見せる数', '個以下'], ['restock', 'priorityHours', '入荷のお知らせのあと優先する時間', '時間'],
    ['payment', 'deadlineMin', 'ネットの支払いを待つ時間', '分'], ['salon', 'deadlineMin', 'サロン：ネットの受付の締め切り', '分前'], ['salon', 'cancelMin', 'サロン：ネットで取り消せるのは', '分前まで'],
    ['salon', 'horizonDays', 'サロン：何日先まで受け付けるか', '日'], ['line', 'monthlyQuota', 'LINEの月の無料通数', '通'], ['line', 'stopReminderUnder', '前日のお知らせを止める残り', '通を切ったら']];
  var STAGES = [['order', '体操服などの取り置き'], ['measure', '採寸の予約'], ['ship', '配送'], ['prepay', 'ネットで先に払う'], ['salon', '水素サロンの予約'], ['voice', 'お客様の声（来店のあとに聞く）']];
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  var ROLE = { owner: 'オーナー', admin: '管理（本人）', staff: '店の人' };

  /* 表の1行を直す欄の決まり */
  function spec(t, r) {
    var schools = r.schools.map(function (s) { return { value: s.id, label: s.short }; });
    if (t === 'schools') return [['name', '学校の名前'], ['short', '短い名前'], ['kind', '種類', { select: ['小', '中', '高'] }], ['measure', '採寸の予約を受ける', { check: 1 }], ['sort', '並び順', { num: 1 }]];
    if (t === 'products') return [['schoolId', '学校', { select: [{ value: '', label: '共通（どの学校も）' }].concat(schools), blank: 1 }], ['cat', '分類', { select: ['体操服', '制服', 'シューズ', 'その他'] }], ['name', '品名'], ['sizes', 'サイズ（「、」で区切る）', { list: 1 }], ['price', '価格（税込・円）', { num: 1 }],
      ['sizePrices', 'サイズごとの価格（例「120:4500, 130:4800」。書いていないサイズは上の価格）', { map: 1 }], ['sizeLabels', 'サイズの見せ方（例「120:5S(120), 130:4S(130)」。空ならサイズのまま）', { map: 1 }],
      ['priceTentative', '仮の価格（お店に確認中）', { check: 1 }], ['needsMeasure', '採寸してから用意する（取り置きにしない）', { check: 1 }], ['required', '学校で必ず要る品', { check: 1 }], ['sizeGuide', 'サイズの目安', { textarea: 1 }], ['note', 'ひとこと'], ['visible', 'お客様に見せる', { check: 1 }], ['sort', '並び順', { num: 1 }]];
    if (t === 'salonMenus') return [['name', 'メニュー名'], ['kind', '種類', { select: ['お試し', '通常', '2名', '学割'] }], ['mins', '時間（分）', { num: 1 }], ['hold', '押さえる時間（分・準備を含む）', { num: 1 }], ['price', '料金（円）', { num: 1 }],
      ['seats', '使う席', { select: [{ value: '1', label: '1席' }, { value: '2', label: '2席（2名同時）' }] }], ['firstOnly', '初めての方だけ', { check: 1 }], ['desc', '説明', { textarea: 1 }], ['airregi', 'Airレジの商品名'], ['visible', 'お客様に見せる', { check: 1 }], ['sort', '並び順', { num: 1 }]];
    if (t === 'measureSlots') return [['schoolId', '学校', { select: r.schools.filter(function (s) { return s.measure; }).map(function (s) { return { value: s.id, label: s.short }; }) }], ['date', '日にち', { date: 1 }], ['start', '始まり', { time: 1 }], ['end', '終わり', { time: 1 }], ['capacity', '定員（組）', { num: 1 }]];
    return [];
  }
  var KEYF = { schools: 'id', products: 'id', salonMenus: 'id', measureSlots: 'id' };
  /* サイズごとの価格・表示名 {120: 4500} を「120:4500, 130:4800」の1行に */
  function mapOf(v) { if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) { return null; } } return v && typeof v === 'object' ? v : null; }
  function mapText(v) { v = mapOf(v); return v ? Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join(', ') : ''; }
  function labelOf(p, z) { var m = mapOf(p.sizeLabels); return (m && m[z]) || z; }
  function rangeOf(p) {
    var m = mapOf(p.sizePrices), list = (p.sizes && p.sizes.length ? p.sizes : ['']).map(function (z) { return m && m[z] != null && m[z] !== '' ? +m[z] : +p.price || 0; });
    var min = Math.min.apply(null, list), max = Math.max.apply(null, list);
    return { min: min, max: max, varies: min !== max };
  }
  function priceText(r, price) { return r ? (r.varies ? u.yen(r.min) + '〜' + u.yen(r.max) : u.yen(r.min)) : u.yen(price); }
  /* 操作の記録の「何を」を日本語で見せる（記録には設定や表の名前がそのまま入るため） */
  var TGT = { campaign: 'お買い上げプレゼントの案内', shop: '店の情報', openDays: '営業日', open: '開店の時刻', close: '閉店の時刻', stages: 'お客様に見せるもの', cart: 'かごの決まり', pickup: '受け取りの決まり', restock: '入荷の決まり', payment: '支払いの決まり', ship: '配送の決まり', salon: 'サロンの決まり', line: 'LINEの決まり', voice: '声の決まり', templates: 'お知らせの文', legal: '決まりの文', shopMembers: '店の人の名簿', sampleData: '見本のデータ',
    schools: '学校', products: '品物', salonMenus: 'サロンのメニュー', holidays: '臨時休業', measureSlots: '採寸の枠' };
  function jpTarget(t) { t = String(t || ''); var p = t.split(' '); if (TGT[p[0]]) p[0] = TGT[p[0]]; return p.join(' '); }
  function rowEditor(t, r, rowObj, title) {
    var f = spec(t, r), v = rowObj || {};
    var html = f.map(function (x) {
      var o = x[2] || {}, val = v[x[0]];
      if (o.check) return check(x[0], x[1], rowObj ? !!val : x[0] === 'visible' || x[0] === 'required');
      if (o.time) return '<div class="field"><label>' + esc(x[1]) + '</label><input class="inp" type="time" step="1800" data-f="' + x[0] + '" value="' + (val != null ? u.hm(val) : '') + '"></div>';
      if (o.date) return '<div class="field"><label>' + esc(x[1]) + '</label><input class="inp" type="date" data-f="' + x[0] + '" value="' + esc(val || '') + '"></div>';
      if (o.select) return ui.field(x[0], x[1], { select: o.select, value: val == null ? '' : val, noBlank: !!o.blank });
      if (o.textarea) return ui.field(x[0], x[1], { textarea: true, value: val, req: false });
      if (o.map) return ui.field(x[0], x[1], { textarea: true, value: mapText(val), req: false });
      return ui.field(x[0], x[1], { value: o.list && val ? val.join('、') : val, mode: o.num ? 'numeric' : 'text' });
    }).join('');
    return '<section class="card sedit" id="sedit"><div class="h2r"><h2>' + esc(title) + '</h2>' + btn('閉じる', 'sEditClose') + '</div><div class="frm" id="rowf"><div class="fgrid">' + html + '</div>' +
      '<div class="row-r">' + (rowObj ? btn(t === 'measureSlots' ? 'この枠を消す' : '見せないようにする', 'sRowDel', { t: t, key: rowObj[KEYF[t]] }) : '') + btn('保存する', 'sRowSave', { t: t }, 'pri') + '</div></div></section>';
  }
  function tableSection(t, r, rows, label, rowHtml, addLabel, pre) {
    var E = st.edit && st.edit.t === t ? st.edit : null;
    var cur = E && E.key ? rows.filter(function (x) { return x[KEYF[t]] === E.key; })[0] : null;
    var ed = E ? rowEditor(t, r, cur, cur ? label(cur) : addLabel) : '';
    return ed + (pre || '') + '<section class="card">' + (rows.map(function (x) {
      return '<div class="li click' + (cur && cur === x ? ' on' : '') + '" data-act="sEdit" data-t="' + t + '" data-key="' + esc(x[KEYF[t]]) + '"><div class="lm">' + rowHtml(x) + '</div><div class="la">' + ico('next', 'chev') + '</div></div>';
    }).join('') || empty('まだありません')) + '</section>' + '<div class="submitbar">' + btn(ico('plus') + addLabel, 'sEdit', { t: t, key: '' }, 'pri') + '</div>';
  }

  var SEC = {
    shop: function (r) {
      var s = r.cfg.shop;
      return '<div class="frm" id="cf"><section class="card"><div class="fgrid">' + SHOP_F.map(function (x) { return ui.field(x[0], x[1], { value: s[x[0]], req: false }); }).join('') + '</div></section></div>' + saveBar('sCfgShop');
    },
    days: function (r) {
      var c = r.cfg;
      var wd = '<div class="wdays">' + WD.map(function (w, i) { return '<label class="chk"><input type="checkbox" data-f="d' + i + '"' + (c.openDays.indexOf(i) >= 0 ? ' checked' : '') + '><span>' + w + '</span></label>'; }).join('') + '</div>';
      var hol = r.holidays.map(function (h) { return row(u.jpDate(h.date), esc(h.reason || ''), btn('外す', 'sHolDel', { date: h.date })); }).join('') || empty('臨時休業の日はありません');
      return '<div class="frm" id="dyf">' + sec('営業する曜日と時間', null, wd + '<div class="fgrid">' +
        '<div class="field"><label>開店</label><input class="inp" type="time" step="1800" data-f="open" value="' + u.hm(c.open) + '"></div>' +
        '<div class="field"><label>閉店</label><input class="inp" type="time" step="1800" data-f="close" value="' + u.hm(c.close) + '"></div></div>' +
        '<p class="t2s">サロンの予約の枠と、受け取り日の選べる日に使います。お客様に見せる書き方は「店の情報」で直します。</p><div class="row-r">' + btn('曜日と時間を保存', 'sDays', {}, 'pri') + '</div>') + '</div>' +
        '<div class="frm" id="hlf">' + sec('臨時休業', r.holidays.length, hol + '<div class="fgrid addrow"><div class="field"><label>休む日</label><input class="inp" type="date" data-f="date"></div>' + ui.field('reason', '理由（お客様に見せる）', { req: false, ph: '例：棚卸しのため' }) + '</div><div class="row-r">' + btn('臨時休業を足す', 'sHolAdd') + '</div>') + '</div>' +
        '<details class="rules"><summary>臨時休業を足すと</summary><ul><li>その日はサロンの予約・受け取り日に選べなくなります。</li><li>すでに入っている予約や受け取りは消えません。カレンダーで確かめて、お客様に電話してください。</li></ul></details>';
    },
    schools: function (r) {
      return tableSection('schools', r, r.schools, function (x) { return x.short; }, function (x) { return '<span class="nm">' + esc(x.name) + '</span>' + (x.visible === false ? '<span class="st">見せていない</span>' : '') + '<div class="ls">' + esc(x.short) + '・' + esc(x.kind || '') + (x.measure ? '・採寸の予約あり' : '') + '</div>'; }, '学校を足す');
    },
    products: function (r) {
      var f = st.pSchool;
      var rows = r.products.filter(function (x) { return !f || (f === 'common' ? !x.schoolId : x.schoolId === f); });
      var sname = {}; r.schools.forEach(function (s) { sname[s.id] = s.short; });
      var pre = '<div class="frm">' + ui.field('ps', '学校で絞る', { select: [{ value: '', label: 'すべて' }].concat(r.schools.map(function (s) { return { value: s.id, label: s.short }; })).concat([{ value: 'common', label: '共通' }]), value: f, noBlank: true, change: 'sPSchool' }) + '</div>' +
        (r.products.some(function (x) { return x.priceTentative; }) ? '<p class="t2s">「仮」の価格は、お店の一覧が届いたら直してください。お客様の画面では「価格は確認中」と出ます。</p>' : '');
      return tableSection('products', r, rows, function (x) { return x.name; }, function (x) {
        return '<span class="nm">' + esc(x.schoolId ? sname[x.schoolId] || '' : '共通') + ' ' + esc(x.name) + '</span>' + (x.visible === false ? '<span class="st">見せていない</span>' : '') +
          '<div class="ls">' + (x.needsMeasure ? '採寸してから' : priceText(rangeOf(x), x.price) + (x.priceTentative ? '（仮）' : '')) + '・サイズ ' + esc((x.sizes || []).map(function (z) { return labelOf(x, z); }).join('、')) + '</div>';
      }, '品物を足す', pre);
    },
    measure: function (r) {
      var sname = {}; r.schools.forEach(function (s) { sname[s.id] = s.short; });
      var rows = r.measureSlots.slice().sort(function (a, b) { return a.date === b.date ? a.start - b.start : (a.date < b.date ? -1 : 1); });
      return tableSection('measureSlots', r, rows, function (x) { return u.shortDate(x.date) + ' ' + u.hm(x.start); }, function (x) {
        return '<span class="tm">' + u.shortDate(x.date) + ' ' + u.hm(x.start) + '〜' + u.hm(x.end) + '</span>' + esc(sname[x.schoolId] || '') + '<div class="ls">定員 ' + x.capacity + '組</div>';
      }, '採寸の枠を足す', '<p class="t2s">予約の数はカレンダーで見られます。予約が入っている枠は消せません。</p>');
    },
    menus: function (r) {
      return tableSection('salonMenus', r, r.menus, function (x) { return x.name; }, function (x) {
        return '<span class="nm">' + esc(x.name) + '</span>' + (x.visible === false ? '<span class="st">見せていない</span>' : '') + '<div class="ls">' + u.yen(x.price) + '・' + x.mins + '分（押さえ ' + x.hold + '分）・' + x.seats + '席' + (x.firstOnly ? '・初めての方だけ' : '') + '</div>';
      }, 'メニューを足す', '<p class="t2s">料金は見本の値です。通常の料金はお店に確認中です。</p>');
    },
    campaign: function (r) {
      var cp = r.cfg.campaign || {}, ids = cp.schoolIds || [];
      var sch = '<div class="wdays">' + r.schools.map(function (s) { return '<label class="chk"><input type="checkbox" data-f="s_' + esc(s.id) + '"' + (ids.indexOf(s.id) >= 0 ? ' checked' : '') + '><span>' + esc(s.short) + '</span></label>'; }).join('') + '</div>';
      return '<div class="frm" id="cpf"><section class="card"><div class="chkrow">' + check('on', 'お客様の画面に出す', !!cp.on) + '</div>' +
        ui.field('title', '見出し', { value: cp.title || '', req: false }) +
        ui.field('text', '案内の文（1行ずつ出ます）', { textarea: true, value: cp.text || '', req: false }) +
        '<div class="field"><label>出す学校</label>' + sch + '</div>' +
        '<p class="t2s">学校の品物の画面（体操服の一覧の上）に出ます。品物ではないので、かごや取り置きの金額には入りません。</p></section></div>' + saveBar('sCampaign');
    },
    templates: function (r) {
      var t = r.cfg.templates;
      return '<details class="rules"><summary>{名前} などの置き換え語</summary><ul>' +
        '<li>{名前} お客様の名前／{番号} 受付番号／{品物} 品物の一覧／{受け取り} 受け取りの日・方法／{支払い} 支払いの方法</li>' +
        '<li>{リンク} お客様が確認・取り消しをする画面へのリンク／{日付} {日時} 予約の日時／{期限} 取り置き・優先の期限／{理由} 取り消しの理由</li>' +
        '<li>{配送} 送り方／{追跡} 問い合わせ番号／{サイズ}／{学校}／{人数}／{メニュー}</li>' +
        '<li>{店名} {電話} {営業時間} {定休} は「店の情報」の値が入ります。</li><li>その文に無い置き換え語は、空になります。</li></ul></details>' +
        '<div class="frm" id="tplf">' + TPL.map(function (x) { return '<section class="card">' + ui.field(x[0], x[1], { textarea: true, value: t[x[0]], req: false }) + '</section>'; }).join('') + '</div>' + saveBar('sTpl');
    },
    legal: function (r) {
      var l = r.cfg.legal;
      return '<div class="frm" id="lgf">' + sec('特定商取引法にもとづく表示', null, ui.field('tokushoho', '表示', { textarea: true, value: l.tokushoho, req: false })) +
        sec('プライバシーポリシー', null, ui.field('privacy', '本文', { textarea: true, value: l.privacy, req: false })) +
        sec('キャンセル・取り消しの決まり', null, ui.field('cancel', '本文', { textarea: true, value: l.cancel, req: false })) +
        sec('版', null, ui.field('version', '版', { value: l.version, help: '文を変えたら版を上げてください（v1 → v2）。お客様が同意した版を、取り置きごとに記録します。' })) + '</div>' + saveBar('sLegal');
    },
    nums: function (r) {
      var c = r.cfg;
      return '<div class="frm" id="nmf"><section class="card"><div class="fgrid">' + NUMS.map(function (x) {
        return ui.field(x[0] + '.' + x[1], x[2] + '（' + x[3] + '）', { value: (c[x[0]] || {})[x[1]], mode: 'numeric', type: 'number' });
      }).join('') + '<div class="field"><label>前日のお知らせを送る時刻</label><input class="inp" type="time" data-f="line.dayBeforeAt" value="' + u.hm(c.line.dayBeforeAt) + '"></div></div></section></div>' + saveBar('sNums');
    },
    stages: function (r) {
      var s = r.cfg.stages;
      return '<div class="frm" id="sgf"><section class="card"><p class="t2s">外すと、お客様の画面にその入口が出なくなります（店の画面では見られます）。</p>' + STAGES.map(function (x) { return '<div class="chkrow">' + check(x[0], x[1], s[x[0]]) + '</div>'; }).join('') + '</section></div>' + saveBar('sStages');
    },
    members: function (r) {
      var can = r.role === 'owner' || r.role === 'admin';
      var list = r.cfg.shopMembers.map(function (m) { return row(esc(m.name) + '<span class="t2s">' + esc(ROLE[m.role] || m.role) + '</span>', esc(m.email), can ? btn('外す', 'sMemDel', { email: m.email }) : ''); }).join('');
      return (can ? '' : '<div class="notice">名簿を変えられるのは、オーナーと管理の人だけです。</div>') + '<section class="card">' + list + '</section>' +
        (can ? '<div class="frm" id="mbf">' + sec('店の人を足す', null, '<div class="fgrid">' + ui.field('name', '呼び名', { ph: '例：娘さん' }) + ui.field('email', 'Googleアカウントのメール', { type: 'email', mode: 'email' }) +
          ui.field('role', '役割', { select: [{ value: 'staff', label: '店の人' }, { value: 'owner', label: 'オーナー' }, { value: 'admin', label: '管理（本人）' }], value: 'staff', noBlank: true }) + '</div><div class="row-r">' + btn('足す', 'sMemAdd', {}, 'pri') + '</div>') + '</div>' : '') +
        '<details class="rules"><summary>名簿の決まり</summary><ul><li>店の画面には、この名簿にあるGoogleアカウントだけが入れます。</li><li>「店の人」は名簿を変えられません。</li></ul></details>';
    },
    audit: function (r, a) {
      return '<section class="card">' + (a.rows.map(function (x) { return row(esc(x.action) + '<span class="t2s">' + esc(jpTarget(x.target)) + '</span>', esc(x.at) + '・' + esc(x.who)); }).join('') || empty('記録はありません')) + '</section><p class="t2s">新しい順に300件まで。</p>';
    }
  };

  /* ================= 操作 ================= */
  function cfgSave(key, value, msg) { return api('shopSettingsSave', { key: key, value: value }).then(done(msg || '保存しました')); }
  var actions = {
    sLogout: function () { KS.shopAuth.logout(); ui.toast('店の画面から出ました'); },
    /* S01・S04 取り置き */
    sOrd: function (el) {
      var s = el.dataset.s, f = scopeForm(el), a = { id: el.dataset.id, status: s };
      if (s === '発送済み') { a.tracking = f.tracking || ''; if (!ui.confirm('発送済みにして、お客様に発送のお知らせを送りますか？')) return false; }
      if (s === '取り消し') { if (!ui.confirm('この取り置きを取り消しますか？品物は在庫に戻ります。')) return false; a.reason = f.reason || ''; a.notify = !!f.notify; }
      if (s === 'pickupDate') { if (!f.pdate) { ui.toast('受け取りの日を選んでください'); return false; } a.date = f.pdate; }
      if (s === 'note') a.note = f.note || '';
      var msg = { '用意済み': '用意済みにしました', '受け取り済み': '受け取り済みにしました', '発送済み': '発送済みにして、お知らせを送りました', '取り消し': '取り消しました', '返金済み': '返金済みにしました', pickupDate: '受け取り日を変えました', note: 'メモを残しました' }[s];
      return api('shopOrderSet', a).then(done(msg));
    },
    /* S01・S03 サロン */
    sSal: function (el) { return api('shopSalonSet', { id: el.dataset.id, status: el.dataset.s }).then(done(el.dataset.s === '来店済み' ? '来店済みにしました' : '変えました')); },
    sMeas: function (el) { return api('shopMeasureSet', { id: el.dataset.id, status: el.dataset.s }).then(done('来店済みにしました')); },
    sSalNote: function (el) { var f = scopeForm(el); return api('shopSalonSet', { id: el.dataset.id, status: 'note', note: f.note || '' }).then(done('メモを残しました')); },
    sCancel: function (el) {
      var f = scopeForm(el);
      if (!ui.confirm(f.kind === '無断キャンセル' ? '無断キャンセルにしますか？' : 'この予約を取り消しますか？')) return false;
      return api('shopSalonSet', { id: el.dataset.id, status: f.kind, reason: f.reason || '', notify: f.kind !== '無断キャンセル' && !!f.notify }).then(function (r) {
        if (!r.ok) { ui.toast(r.message); return; }
        ui.toast(f.kind === '無断キャンセル' ? '無断キャンセルにしました' : '取り消しました');
        KS.app.go('s/cal?d=' + el.dataset.d); return false;
      });
    },
    sMvDate: function (el) { st.mv.date = el.value; st.mv.start = null; st.mv.open = 'move'; },
    sMvTime: function (el) { st.mv.start = +el.dataset.t; st.mv.open = 'move'; },
    sMove: function (el) {
      var mv = st.mv, f = scopeForm(el);
      if (!mv.date || mv.start == null) { ui.toast('日にちと時間を選んでください'); return false; }
      return api('shopSalonSet', { id: el.dataset.id, status: 'move', date: mv.date, start: mv.start, notify: !!f.notify }).then(function (r) {
        if (!r.ok) { ui.toast(r.message); return; }
        ui.toast('日時を変えました'); var d = mv.date; st.mv = {};
        KS.app.go('s/book/' + encodeURIComponent(el.dataset.id) + '?d=' + d); return false;
      });
    },
    /* S03 新しい予約 */
    sBkMenu: function (el) { keep('bkf', st.bk); st.bk.menuId = el.value; st.bk.start = null; st.bkDone = null; st.bkErr = {}; },
    sBkDate: function (el) { keep('bkf', st.bk); st.bk.date = el.value; st.bk.start = null; st.bkDone = null; },
    sBkTime: function (el) { keep('bkf', st.bk); st.bk.start = +el.dataset.t; st.bkDone = null; },
    sBkSave: function () {
      var bk = keep('bkf', st.bk);
      return api('shopSalonCreate', { form: { menuId: bk.menuId, date: bk.date, start: bk.start, name: bk.name, kana: bk.kana, phone: bk.phone, email: bk.email, channel: bk.channel || '電話', note: bk.note } }).then(function (r) {
        if (!r.ok) {
          st.bkErr = r.errors || {}; if (r.code === 'slot' || r.code === 'first') st.bkErr.slot = r.message;
          ui.toast(r.message); return;
        }
        st.bkDone = { menuName: r.booking.menuName, date: r.booking.date, start: r.booking.start, candidate: r.candidate };
        st.bkErr = {}; st.bk = { date: bk.date, _today: bk._today, channel: bk.channel };
        ui.toast('予約を入れました');
      });
    },
    /* S03 席の押さえ */
    sBlkDate: function (el) { keep('blkf', st.blk); st.blk.date = el.value; st.blk._d = ''; },
    sBlkAdd: function () {
      var b = keep('blkf', st.blk);
      if (+b.end <= +b.start) { ui.toast('「まで」は「から」より後にしてください'); return false; }
      return api('shopBlockAdd', { date: b.date, start: +b.start, end: +b.end, seatIds: b.seat ? [b.seat] : [], reason: b.reason || '店の用事' }).then(done('席を押さえました'));
    },
    sBlkDel: function (el) { if (!ui.confirm('この押さえを外しますか？外すと、お客様が予約できるようになります。')) return false; keep('blkf', st.blk); return api('shopBlockRemove', { id: el.dataset.id }).then(done('押さえを外しました')); },
    /* S05 在庫 */
    sStkSchool: function (el) { KS.app.go('s/stock' + (el.value ? '?school=' + encodeURIComponent(el.value) : '')); return false; },
    sStkPick: function (el) { st.stock = { sel: { pid: el.dataset.pid, size: el.dataset.size, label: el.dataset.label }, mode: 'in', qty: '', pv: null, notify: true, scroll: true }; },
    sStkMode: function (el) { st.stock.mode = el.dataset.m; st.stock.pv = null; st.stock.qty = ''; },
    sStkClose: function () { st.stock.sel = null; st.stock.pv = null; },
    sStkReset: function () { st.stock.pv = null; },
    sStkPreview: function () {
      var S = st.stock, f = keep('stkf', {});
      var q = Math.floor(+f.qty || 0); if (q < 1) { ui.toast('入荷した数を入れてください'); return false; }
      S.qty = q;
      return api('shopRestockPreview', { productId: S.sel.pid, size: S.sel.size, qty: q }).then(function (r) { if (!r.ok) { ui.toast(r.message); return; } S.pv = r; S.notify = true; });
    },
    sStkSend: function () {
      var S = st.stock, f = keep('stkf', {});
      var q = Math.floor(+f.qty || 0); if (q !== +S.qty) { S.pv = null; S.qty = q; ui.toast('数が変わったので、もう一度確かめてください'); return; }
      var notify = !f.nonotify;
      return api('shopRestockSend', { productId: S.sel.pid, size: S.sel.size, qty: q, notify: notify }).then(function (r) {
        if (!r.ok) { ui.toast(r.message); return; }
        ui.toast('入荷を ' + r.added + ' 入れました' + (notify ? '。' + r.sent + '人にお知らせしました' : ''));
        S.pv = null; S.qty = '';
      });
    },
    sStkSet: function () {
      var S = st.stock, f = keep('stkf', {});
      if (f.qty === '' || +f.qty < 0) { ui.toast('数を入れてください'); return false; }
      return api('shopStockSet', { productId: S.sel.pid, size: S.sel.size, qty: +f.qty }).then(function (r) { done('数を直しました')(r); if (r.ok) S.qty = ''; });
    },
    /* S06 お客様 */
    sCusFind: function () { var el = document.getElementById('cq'); var q = el ? el.value.trim() : ''; KS.app.go('s/customers' + (q ? '?q=' + encodeURIComponent(q) : '')); return false; },
    sCusSave: function (el) { var f = keep('cmf', {}); return api('shopCustomerSet', { id: el.dataset.id, memo: f.memo || '' }).then(done('メモを残しました')); },
    sCusEdit: function (el) {
      var f = keep('cef', {});
      if (!String(f.name || '').trim()) { ui.toast('お名前を入れてください'); return false; }
      return api('shopCustomerSet', { id: el.dataset.id, name: f.name, kana: f.kana, phone: f.phone }).then(done('直しました'));
    },
    sMergeFind: function (el) {
      var q = (document.getElementById('mq') || {}).value || '';
      if (!q.trim()) { ui.toast('名前か電話を入れてください'); return false; }
      return api('shopCustomers', { q: q.trim() }).then(function (r) { if (!r.ok) { ui.toast(r.message); return; } st.merge = { forId: el.dataset.id, q: q, rows: r.rows.filter(function (x) { return x.id !== el.dataset.id; }).slice(0, 20) }; });
    },
    sMergeTo: function (el) {
      if (!ui.confirm('この方の記録を、選んだ方にまとめますか？元には戻せません。')) return false;
      return api('shopCustomerSet', { id: el.dataset.id, mergeInto: el.dataset.to }).then(function (r) {
        if (!r.ok) { ui.toast(r.message); return; }
        st.merge = null; ui.toast('1人にまとめました'); KS.app.go('s/customers/' + encodeURIComponent(el.dataset.to)); return false;
      });
    },
    /* S08 設定 */
    sCfgShop: function () { var f = keep('cf', {}), v = {}, s = st.set.cfg.shop; for (var k in s) v[k] = s[k]; for (var j in f) v[j] = f[j]; return cfgSave('shop', v); },
    sDays: function () {
      var f = keep('dyf', {}), days = [];
      for (var i = 0; i < 7; i++) if (f['d' + i]) days.push(i);
      var o = u.toMin(f.open), c = u.toMin(f.close);
      if (!days.length) { ui.toast('営業する曜日を選んでください'); return false; }
      if (!(c > o)) { ui.toast('閉店は開店より後にしてください'); return false; }
      return api('shopSettingsSave', { key: 'openDays', value: days }).then(function (r) { if (!r.ok) return r; return api('shopSettingsSave', { key: 'open', value: o }); })
        .then(function (r) { if (!r.ok) return r; return api('shopSettingsSave', { key: 'close', value: c }); }).then(done('保存しました'));
    },
    sHolAdd: function () {
      var f = keep('hlf', {});
      if (!f.date) { ui.toast('休む日を選んでください'); return false; }
      return api('shopRowSave', { table: 'holidays', row: { date: f.date, reason: f.reason || '臨時休業' } }).then(done('臨時休業を足しました'));
    },
    sHolDel: function (el) { if (!ui.confirm(el.dataset.date + ' の臨時休業を外しますか？')) return false; return api('shopRowRemove', { table: 'holidays', key: el.dataset.date }).then(done('外しました')); },
    sPSchool: function (el) { st.pSchool = el.value; st.edit = null; },
    sEdit: function (el) { st.edit = { t: el.dataset.t, key: el.dataset.key }; st.scrollEdit = true; },
    sEditClose: function () { st.edit = null; },
    sRowSave: function (el) {
      var t = el.dataset.t, f = keep('rowf', {}), r = st.set, row0 = {};
      spec(t, r).forEach(function (x) {
        var o = x[2] || {}, v = f[x[0]];
        if (o.num) v = v === '' ? 0 : +v;
        else if (o.time) { if (!v) return; v = u.toMin(v); }
        else if (o.check) v = !!v;
        row0[x[0]] = v;
      });
      if (st.edit && st.edit.key) row0[KEYF[t]] = st.edit.key;
      if (t === 'measureSlots' && !(row0.end > row0.start)) { ui.toast('終わりは始まりより後にしてください'); return false; }
      if ((t === 'schools' || t === 'salonMenus') && !String(row0.name || '').trim()) { ui.toast('名前を入れてください'); return false; }
      return api('shopRowSave', { table: t, row: row0 }).then(function (res) { if (!res.ok) { ui.toast(res.message); return; } st.edit = null; ui.toast('保存しました'); });
    },
    sRowDel: function (el) {
      var t = el.dataset.t;
      if (!ui.confirm(t === 'measureSlots' ? 'この採寸の枠を消しますか？' : 'お客様の画面に見せないようにしますか？（記録は残ります）')) return false;
      return api('shopRowRemove', { table: t, key: el.dataset.key }).then(function (r) { if (!r.ok) { ui.toast(r.message); return; } st.edit = null; ui.toast(r.hidden ? '見せないようにしました' : '消しました'); });
    },
    sTpl: function () { var f = keep('tplf', {}), v = {}, t = st.set.cfg.templates; for (var k in t) v[k] = t[k]; for (var j in f) v[j] = f[j]; return cfgSave('templates', v); },
    sLegal: function () { var f = keep('lgf', {}), v = {}, l = st.set.cfg.legal; for (var k in l) v[k] = l[k]; for (var j in f) v[j] = f[j]; return cfgSave('legal', v); },
    sNums: function () {
      var f = keep('nmf', {}), c = st.set.cfg, groups = {};
      for (var k in f) {
        var p = k.split('.'); if (p.length !== 2) continue;
        var val = p[1] === 'dayBeforeAt' ? u.toMin(f[k]) : +f[k];
        if (isNaN(val) || val < 0) { ui.toast('数を確かめてください'); return false; }
        if (!groups[p[0]]) { groups[p[0]] = {}; for (var x in (c[p[0]] || {})) groups[p[0]][x] = c[p[0]][x]; }
        groups[p[0]][p[1]] = val;
      }
      var keys = Object.keys(groups), chain = Promise.resolve({ ok: true });
      keys.forEach(function (g) { chain = chain.then(function (r) { if (!r.ok) return r; return api('shopSettingsSave', { key: g, value: groups[g] }); }); });
      return chain.then(done('保存しました'));
    },
    sCampaign: function () {
      var f = keep('cpf', {}), ids = st.set.schools.filter(function (s) { return !!f['s_' + s.id]; }).map(function (s) { return s.id; });
      if (f.on && !String(f.text || '').trim()) { ui.toast('案内の文を入れてください'); return false; }
      return cfgSave('campaign', { on: !!f.on, title: String(f.title || '').trim(), text: String(f.text || '').trim(), schoolIds: ids });
    },
    sStages: function () { var f = keep('sgf', {}), v = {}; STAGES.forEach(function (x) { v[x[0]] = !!f[x[0]]; }); return cfgSave('stages', v); },
    sMemAdd: function () {
      var f = keep('mbf', {}), list = st.set.cfg.shopMembers.slice();
      if (!String(f.name || '').trim()) { ui.toast('呼び名を入れてください'); return false; }
      if (!u.okEmail(f.email)) { ui.toast('メールを確かめてください'); return false; }
      var e = u.normEmail(f.email);
      if (list.some(function (m) { return String(m.email).toLowerCase() === e; })) { ui.toast('すでに名簿にあります'); return false; }
      list.push({ email: e, name: f.name.trim(), role: f.role || 'staff' });
      return cfgSave('shopMembers', list, '足しました');
    },
    sMemDel: function (el) {
      var list = st.set.cfg.shopMembers.filter(function (m) { return m.email !== el.dataset.email; });
      if (!list.some(function (m) { return m.role === 'owner' || m.role === 'admin'; })) { ui.toast('オーナーか管理の人が1人は要ります'); return false; }
      if (!ui.confirm(el.dataset.email + ' を名簿から外しますか？')) return false;
      return cfgSave('shopMembers', list, '外しました');
    }
  };

  function after() {
    var g = document.getElementById('gbtn');
    if (g) KS.shopAuth.renderButton(g, KS.app.render);
    var cq = document.getElementById('cq');
    if (cq) cq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); actions.sCusFind(); } });
    var mq = document.getElementById('mq');
    if (mq) mq.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); var b = document.querySelector('[data-act="sMergeFind"]'); if (b) b.click(); } });
    if ((st.stock.scroll || st.scrollEdit) && document.getElementById('sedit')) {
      document.getElementById('sedit').scrollIntoView({ block: 'start' });
      window.scrollBy(0, -56);
    }
    st.stock.scroll = false; st.scrollEdit = false;
  }

  function route(rest, p) {
    var a = rest[0] || '';
    if (a === 'cal') return cal(p);
    if (a === 'book') return rest[1] ? bookEdit(rest[1], p) : book(p);
    if (a === 'orders') return rest[1] ? orderDetail(rest[1]) : orders(p);
    if (a === 'stock') return stock(p);
    if (a === 'customers') return rest[1] ? custDetail(rest[1]) : customers(p);
    if (a === 'notices') return notices(p);
    if (a === 'settings') return settings(rest[1] || '', p);
    if (a === 'more') return more();
    return today(p);
  }

  return { route: route, actions: actions, after: after, login: login };
})();
