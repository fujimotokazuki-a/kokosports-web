/* ココスポーツ 本番：運営ボード（B01〜B07）。オーナー・娘さん・本人が見る
   住所：#/b（B01 概要）／#/b/reach（B02 集客）／#/b/book（B03 予約）／#/b/sales（B04 売上）／#/b/people（B05 お客様）／#/b/voice（B06 声）／#/b/three（B07 今週の3つの数字）
   数字は board の1回の呼び出しで取る（core/board.js）。色は紺と淡い青の2色まで
   店の人だけ（入っていなければ店の画面と同じログインの案内） */
KS.views = KS.views || {};
KS.views.b = (function () {
  var ui = KS.ui, esc = ui.esc, ico = ui.ico, u = KS.core.u;
  var NAV = [['', '概要', 'B01'], ['reach', '集客', 'B02'], ['book', '予約', 'B03'], ['sales', '売上', 'B04'], ['people', 'お客様', 'B05'], ['voice', '声', 'B06'], ['three', '今週の3つの数字', 'B07']];

  function frame(cur, title, d, body) {
    return '<div class="sp bd">' +
      '<aside class="snav"><div class="sbrand">ココスポーツ<small>運営ボード</small></div>' +
      NAV.map(function (x) { return '<a href="#/b' + (x[0] ? '/' + x[0] : '') + '" class="' + (cur === x[0] ? 'on' : '') + '">' + ico('chart') + x[1] + '</a>'; }).join('') +
      '<div class="g">店の画面</div><a href="#/s">' + ico('home') + '今日</a></aside>' +
      '<main class="smain"><header class="shd"><h1>' + esc(title) + '</h1><span class="sub">' + (d ? u.jpDate(d.today) + 'の時点' : '') + '</span><a class="ul sm r only-sp" href="#/s">店の画面へ</a></header>' +
      '<nav class="btabs">' + NAV.map(function (x) { return '<a href="#/b' + (x[0] ? '/' + x[0] : '') + '" class="' + (cur === x[0] ? 'on' : '') + '">' + x[1] + '</a>'; }).join('') + '</nav>' +
      body + '</main></div>';
  }
  function kpi(l, v, d) { return '<div class="kpi"><div class="l">' + esc(l) + '</div><div class="v">' + v + '</div><div class="d">' + (d || '') + '</div></div>'; }
  function card(title, body, note) { return '<section class="card"><h2>' + esc(title) + '</h2>' + body + (note ? '<p class="note-ex">' + note + '</p>' : '') + '</section>'; }
  function ml(s) { return String(s).replace(/^0/, ''); }
  function months(rows) { return rows.map(function (r) { return [ml(r[0]), r[1]]; }); }
  function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 : 0; }
  function nodata(rows) { return !rows.length || rows.every(function (r) { return !r[1]; }); }
  function bars(rows, o) { return nodata(rows) ? '<div class="empty">まだ数字がありません</div>' : ui.bars(rows, o); }
  function cols(rows, o) { return nodata(rows) ? '<div class="empty">まだ数字がありません</div>' : ui.cols(rows, o); }
  /* 売上の積み上げ（取り置き＝紺、サロン＝淡い青） */
  function stack(byMonth) {
    var max = Math.max.apply(null, byMonth.map(function (m) { return m.goods + m.salon; }).concat([1]));
    return '<div class="cols">' + byMonth.map(function (m) {
      var t = m.goods + m.salon, h = Math.max(2, t / max * 120);
      return '<div class="c"><span>' + (t ? Math.round(t / 1000).toLocaleString('ja-JP') + '千' : '0') + '</span><div class="stkbar" style="height:' + h + 'px">' +
        '<i class="sky" style="height:' + (t ? m.salon / t * 100 : 0) + '%"></i><i style="height:' + (t ? m.goods / t * 100 : 0) + '%"></i></div></div>';
    }).join('') + '</div><div class="colx">' + byMonth.map(function (m) { return '<span>' + (+m.month.slice(5)) + '月</span>'; }).join('') + '</div>' +
      '<div class="lg"><span><i></i>取り置き・注文</span><span><i class="sky"></i>サロン（来店済み）</span></div>';
  }

  var PAGES = {
    '': function (d) {
      var s = d.summary, b = d.bookings, sal = d.sales.byMonth, cur = sal[sal.length - 1];
      return '<div class="kpis">' +
        kpi('お客様', u.num(s.customers) + '人', 'LINEでつながっている方 ' + s.lineFriends + '人') +
        kpi('これからのサロン予約', s.upcomingSalon + '件', '取り消し率 ' + b.salonCancelRate + '%') +
        kpi('進行中の取り置き', s.openOrders + '件', '入荷を待っている方 ' + s.waiting + '人') +
        kpi('今月のLINEの残り', s.quota.left + '通', '無料 ' + s.quota.quota + '通のうち') +
        kpi('今月の見込みの売上', u.yen(cur.goods + cur.salon), '取り置き ' + u.yen(cur.goods) + '・サロン ' + u.yen(cur.salon)) +
        kpi('お客様の声', s.reviews ? s.avgStars + '点' : '—', s.reviews + '件') +
        kpi('入荷のお知らせから取り置き', b.restock.converted + '件', 'お知らせ ' + b.restock.notified + '件のうち') +
        kpi('採寸の予約', b.measure + '組', 'これからの予約') + '</div>' +
        '<div class="grid2">' + card('月ごとの新しいお客様', cols(months(d.reach.newByMonth))) + card('月ごとの見込みの売上', stack(sal), '実際の会計はAirレジ。ここは予約と取り置きから見込める額です。') + '</div>' +
        card('今週の3つの数字', d.three.map(function (t) { return '<div class="li"><div class="lm">' + esc(t.name) + '</div><div class="la"><span class="v3">' + t.value + '</span>' + esc(t.unit) + '</div></div>'; }).join('') + '<p><a class="ul sm" href="#/b/three">くわしく</a></p>');
    },
    reach: function (d) {
      var r = d.reach;
      var tbl = '<table class="t"><tr><th>学校</th><th class="n">お客様</th><th class="n">取り置き</th><th class="n">入荷待ち</th></tr>' + r.bySchool.map(function (x) { return '<tr><td>' + esc(x.school) + '</td><td class="n">' + x.people + '</td><td class="n">' + x.orders + '</td><td class="n">' + x.waits + '</td></tr>'; }).join('') + '</table>';
      return '<div class="kpis">' + kpi('お客様', u.num(d.summary.customers) + '人') + kpi('LINEでつながっている方', d.summary.lineFriends + '人', 'ブロック ' + d.summary.blocked + '人') + '</div>' +
        card('学校ごと', tbl, 'お客様は、取り置きや予約で学校を選んだ方の数。取り置きは取り消しと未払いを除く件数。') +
        '<div class="grid2">' + card('どこで知ったか', bars(r.heard), '初めての予約で聞いた答え。答えていない方は最初の入口（LINE・Instagramなど）で数えます。') + card('月ごとの新しいお客様', cols(months(r.newByMonth))) + '</div>' +
        '<p class="note-ex">LINEでつながっている方は、このしくみを開いた方の数です。公式LINEの管理画面の友だち数とは違います。</p>';
    },
    book: function (d) {
      var b = d.bookings;
      return '<div class="kpis">' + kpi('サロンの取り消し率', b.salonCancelRate + '%', '取り消しと無断キャンセル ÷ すべての予約') +
        kpi('採寸の予約', b.measure + '組', 'これからの予約') +
        kpi('入荷のお知らせ → 取り置き', pct(b.restock.converted, b.restock.notified) + '%', 'お知らせ ' + b.restock.notified + '件のうち ' + b.restock.converted + '件') +
        kpi('これからのサロン予約', d.summary.upcomingSalon + '件') + '</div>' +
        '<div class="grid2">' + card('サロンの予約（月別）', cols(months(b.salonByMonth)), '予約中と来店済み。2名同時も1件と数えます。') + card('サロンのメニュー別', bars(b.menus)) +
        card('取り置き・注文（月別）', cols(months(b.ordersByMonth), {}), '受付の日で数えます。取り消しと未払いは除きます。') + card('受付の経路', bars(b.channel), '取り置きとサロンの予約の合計。') + '</div>';
    },
    sales: function (d) {
      var s = d.sales, tg = u.sum(s.byMonth, function (m) { return m.goods; }), ts = u.sum(s.byMonth, function (m) { return m.salon; });
      var tbl = '<table class="t"><tr><th>月</th><th class="n">取り置き・注文</th><th class="n">サロン</th><th class="n">合計</th></tr>' + s.byMonth.slice().reverse().map(function (m) { return '<tr><td>' + (+m.month.slice(0, 4)) + '年' + (+m.month.slice(5)) + '月</td><td class="n">' + u.yen(m.goods) + '</td><td class="n">' + u.yen(m.salon) + '</td><td class="n">' + u.yen(m.goods + m.salon) + '</td></tr>'; }).join('') + '</table>';
      return '<p class="note-ex">見込みの額です。実際の会計はAirレジ（つなぐのは別の段階）。取り置きは受付の月、サロンは来店済みの月で数えます。</p>' +
        '<div class="kpis">' + kpi('6か月の見込み', u.yen(tg + ts)) + kpi('取り置き・注文', u.yen(tg)) + kpi('サロン', u.yen(ts)) + kpi('ネットで先に払われた額', u.yen(s.prepaid), 'Squareで支払い済み') + '</div>' +
        '<div class="grid2">' + card('月ごと', stack(s.byMonth)) + card('月ごとの表', tbl) + '</div>';
    },
    people: function (d) {
      var p = d.people;
      return '<div class="kpis">' + kpi('サロンに来た方', p.visitors + '人', '来店済みが1回以上') + kpi('2回以上来た方', p.repeaters + '人') + kpi('2回以上の率', p.repeatRate + '%', '2回以上 ÷ 来た方') + kpi('お客様', u.num(d.summary.customers) + '人') + '</div>' +
        '<div class="grid2">' + card('月ごとの新しいお客様', cols(months(p.newByMonth))) +
        card('見方', '<ul class="plain"><li>2回以上の率は、サロンに来た方のうち、来店済みが2回以上ある方の割合です。</li><li>同じ方が電話とLINEで別々に登録されていると、少なく出ます。店の画面の「お客様」で同じ方をまとめてください。</li></ul>') + '</div>';
    },
    voice: function (d) {
      var v = d.voice;
      var list = v.latest.map(function (x) {
        return '<div class="li"><div class="lm"><span class="nm">' + x.stars + '点</span><span class="t2s">' + esc(x.date || String(x.at).slice(0, 10)) + '</span>' + (x.customerId ? '<a class="ul sm" href="#/s/customers/' + encodeURIComponent(x.customerId) + '">お客様</a>' : '') +
          '<div class="ls">' + (x.text ? esc(x.text) : '<span class="t3">ひとことなし</span>') + (x.toShop ? '<br>お店へ：' + esc(x.toShop) : '') + '</div></div></div>';
      }).join('') || '<div class="empty">まだ声はありません</div>';
      return '<div class="kpis">' + kpi('声の数', v.count + '件') + kpi('平均', v.count ? v.avg + '点' : '—', '5点満点') + '</div>' +
        '<div class="grid2">' + card('点数の分かれ方', bars(v.stars)) + card('最近の声', list, '点数で案内を分けていません（低い点の方にもGoogleのクチコミを同じように案内します）。') + '</div>';
    },
    three: function (d) {
      return '<p class="note-ex">直近7日（' + u.shortDate(u.addDays(d.today, -6)) + '〜' + u.shortDate(d.today) + '）。毎週この3つだけ見て、次の一手を決めます。</p>' +
        '<div class="three">' + d.three.map(function (t, i) { return '<section class="card"><div class="l">' + (i + 1) + '. ' + esc(t.name) + '</div><div class="big">' + t.value + '<small>' + esc(t.unit) + '</small></div><p class="note-ex">' + esc(t.note) + '</p></section>'; }).join('') + '</div>' +
        '<details class="rules"><summary>この3つにした理由</summary><ul><li>新しく友だちになった方：LINEの入口（チラシのQR・Instagram）が効いているか。</li><li>取り置き・予約の受付：お店の手間が電話から画面に移っているか。</li><li>入荷のお知らせから取り置き：品切れで帰ったお客様を取り戻せているか。</li></ul></details>';
    }
  };

  function route(rest) {
    var cur = rest[0] || '';
    if (!PAGES[cur]) cur = '';
    var title = NAV.filter(function (x) { return x[0] === cur; })[0][1];
    return KS.api.call('board', {}).then(function (d) {
      if (!d.ok) {
        if (d.code === 'auth') return KS.views.s.login(d);
        return frame(cur, title, null, '<div class="notice ng">' + esc(d.message || '読み込めませんでした。') + '</div>');
      }
      return frame(cur, title, d, PAGES[cur](d));
    });
  }
  function after() { if (KS.views.s && KS.views.s.after) KS.views.s.after(); }

  return { route: route, actions: {}, after: after };
})();
