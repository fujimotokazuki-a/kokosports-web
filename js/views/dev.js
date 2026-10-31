/* ココスポーツ 本番：試しの道具（backend が 'local' のときだけ出る。本番では出ない）
   - だれとして開くか（LINEの友だち／新しい友だち／LINEの外の人）
   - 店の人として入る
   - 時計を進める（前日のお知らせ・24時間の繰り上げ・未払いの取り消しを試す）
   - お客様に届いたLINE・メールを見る（「画面」の LINE で、選んだ人のトークの見え方でも見られる。views/line.js） */
KS.views.dev = (function () {
  var ui = KS.ui, esc = ui.esc, L = KS.local;
  /* スマホの幅では最初は閉じておく（店の画面の下の切り替えに重なるため） */
  var open = window.innerWidth >= 900;
  try { var saved = localStorage.getItem('ks_devOpen'); if (saved != null) open = saved !== '0'; } catch (e) { }

  function panel(area) {
    var s = L.dev.state(), now = L.dev.now(), u = KS.core.u;
    var who = s.dev.as;
    var users = L.dev.lineUsers();
    var box = L.dev.outbox().slice(0, 12);
    if (!open) return '<aside class="devpanel shut"><button class="devtoggle" data-act="devToggle">試しの道具を開く</button></aside>';
    return '<aside class="devpanel">' +
      '<div class="devhd"><b>試しの道具</b><span>このPCの中だけ・見本のデータ</span><button class="linkbtn" data-act="devToggle">閉じる</button></div>' +
      '<div class="devsec"><h4>画面</h4><div class="devnav">' +
      '<a href="#/c" class="' + (area === 'c' ? 'on' : '') + '">お客様</a><a href="#/s" class="' + (area === 's' ? 'on' : '') + '">店</a><a href="#/b" class="' + (area === 'b' ? 'on' : '') + '">運営ボード</a><a href="#/l" class="' + (area === 'l' ? 'on' : '') + '">LINE</a></div></div>' +
      '<div class="devsec"><h4>お客様として開く</h4><select class="inp sm" data-change="devAs">' +
      users.map(function (x) { return '<option value="' + esc(x.as) + '"' + (x.as === who ? ' selected' : '') + '>LINEの友だち：' + esc(x.name) + '</option>'; }).join('') +
      (who.indexOf('line:Unew') === 0 ? '<option value="' + esc(who) + '" selected>LINEの新しい友だち</option>' : '') +
      '<option value="web"' + (who === 'web' ? ' selected' : '') + '>LINEの外の人（Instagram・HPから）</option></select>' +
      '<button class="linkbtn" data-act="devNewFriend">新しく友だちになった人で開く</button>' +
      '<div class="devlinks"><a href="#/c?utm_source=instagram&utm_medium=social&utm_campaign=always&utm_content=bio">Instagramのリンクから</a><a href="#/c/school?utm_source=flyer&utm_medium=print&utm_campaign=2611_school&utm_content=ikisu">チラシのQRから（体操服）</a><a href="#/c/salon">LINEのメニュー「水素サロン」</a><a href="#/c/my">LINEのメニュー「わたしの予約」</a></div></div>' +
      '<div class="devsec"><h4>店の人として入る</h4><div class="devrow">' + (s.dev.shopEmail ? '<span>' + esc(s.dev.shopEmail) + '</span><button class="linkbtn" data-act="devShopOut">出る</button>' : '<button class="linkbtn" data-act="devShopIn" data-email="owner@example.com">オーナーで入る</button><button class="linkbtn" data-act="devShopIn" data-email="fujimoto3456@gmail.com">藤本さんで入る</button>') + '</div></div>' +
      '<div class="devsec"><h4>時計</h4><div class="devrow"><b>' + u.jpDate(now.date) + ' ' + u.hm(now.min) + '</b>' + (s.offset ? '<span class="t3">（進めた）</span>' : '') + '</div><div class="devrow">' +
      '<button class="btn sm" data-act="devAdv" data-min="60">1時間</button><button class="btn sm" data-act="devAdv" data-min="1440">1日</button><button class="btn sm" data-act="devAdvTo" data-min="1020">17:00へ</button><button class="linkbtn" data-act="devClock">今に戻す</button></div></div>' +
      '<div class="devsec"><h4>お客様に届いたもの <small>（LINEの返信は通数0）</small></h4><ul class="devbox">' +
      (box.length ? box.map(function (m) { return '<li><div class="mt"><span class="via ' + (m.via === 'LINE' ? 'ln' : 'ml') + '">' + esc(m.via) + (m.mode === 'reply' ? '・返信' : m.mode === 'push' ? '・1通' : '') + '</span>' + esc(m.toName) + '<span class="t3">' + esc(m.at.slice(5)) + '</span></div><div class="tx">' + ui.br(m.text) + '</div></li>'; }).join('') : '<li class="t3">まだありません</li>') +
      '</ul>' + (box.length ? '<button class="linkbtn" data-act="devClearBox">空にする</button>' : '') + '</div>' +
      '<div class="devsec"><button class="linkbtn" data-act="devReset">見本のデータを最初に戻す</button></div>' +
      '</aside>';
  }

  var actions = {
    devToggle: function () { open = !open; try { localStorage.setItem('ks_devOpen', open ? '1' : '0'); } catch (e) { } },
    devAs: function (el) { L.dev.setAs(el.value); ui.toast(el.value === 'web' ? 'LINEの外の人として開きます' : 'LINEの友だちとして開きます'); },
    devNewFriend: function () { L.dev.newLineFriend(); ui.toast('新しい友だちとして開きます'); KS.app.go('c'); return false; },
    devShopIn: function (el) { L.dev.shopLogin(el.dataset.email); ui.toast('店の人として入りました'); },
    devShopOut: function () { L.dev.shopLogin(''); },
    devAdv: function (el) { L.dev.advance(+el.dataset.min); ui.toast('時計を進めました'); },
    devAdvTo: function (el) { var n = L.dev.now(), t = +el.dataset.min, d = t - n.min; if (d <= 0) d += 1440; L.dev.advance(d); ui.toast('時計を進めました'); },
    devClock: function () { L.dev.resetClock(); },
    devClearBox: function () { L.dev.clearOutbox(); },
    devReset: function () { if (ui.confirm('見本のデータを最初の状態に戻しますか？（このPCの中だけ）')) { L.dev.reset(); try { localStorage.removeItem('ks_cartId'); } catch (e) { } ui.toast('最初に戻しました'); } }
  };
  return { panel: panel, actions: actions };
})();
