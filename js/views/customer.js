/* ココスポーツ 本番：お客様の画面（C00〜C90）
   設計の正本：資料庫「画面遷移 v02」第1〜4章。住所は README の「画面の住所」のとおり
   - 裏側の呼び出しは KS.api.call だけ（試しの形でも本番でも同じコード）
   - 入力の途中は D に持つ（このタブの間だけ sessionStorage に残す）。描き直しても、読み込み直しても消えない
   - 呼び出しが ok:false のときは code で分かれ道を作る
     soldout→C20／lost・empty→C13／expired・gone・network・error→C90／input→入力欄の下にエラー
   - お客様に見える文字に、開発の言葉（試し・デモ など）と、水素の効果をうたう言葉を出さない */
KS.views = KS.views || {};   /* app.js が最後に読まれるため、先に入れ物を作る（app.js 側で直れば不要） */
KS.views.c = (function () {
  var ui = KS.ui, esc = ui.esc, ico = ui.ico, u = KS.core.u;
  var TEL0 = '0299-92-0272';
  var ORDER_STEPS = ['かご', '受け取り方', '確認', '完了'];
  var SALON_STEPS = ['メニュー', '日時', '連絡先', '確認'];
  var B = null, bootAt = 0;          // boot の結果（店の情報・段階・LINEの中か）
  var D = loadDraft();               // 入力の途中
  var errs = {};                     // 入力欄の下に出すエラー { 画面: { 欄: 文 } }
  var flash = null;                  // その住所で一度出すお知らせ { hash, kind, text }
  var trouble = null;                // C90 を出す住所と種類 { hash, kind, msg }
  var formKey = '', nextFormKey = '', nextReceive = '', timer = null;

  /* ================= 小道具 ================= */
  function loadDraft() { try { return JSON.parse(sessionStorage.getItem('ks_c_draft')) || {}; } catch (e) { return {}; } }
  function saveDraft() { try { sessionStorage.setItem('ks_c_draft', JSON.stringify(D)); } catch (e) { } }
  function dr(k) { return D[k] || (D[k] = {}); }
  function call(name, args) {
    return KS.api.call(name, args || {}).then(function (r) {
      r = r || { ok: false, code: 'error' };
      if (r.ok && !READS[name]) fastClear();   /* 申し込み・取り消しのあとは、覚えた空きや在庫を使わない */
      return r;
    }, function () { return { ok: false, code: 'network' }; });
  }
  var READS = { boot: 1, schools: 1, schoolItems: 1, item: 1, measureSchools: 1, measureSlots: 1, cart: 1, detail: 1, myList: 1, salonMenus: 1, salonWeek: 1, salonForm: 1, checkoutInfo: 1, orderDone: 1 };
  /* だれが見ても同じ中身（料金表・学校・試着の空きなど）は、この端末に覚えておき、次からはすぐ出す。
     裏では新しい中身を取りに行き、違っていれば同じ画面にいるあいだに描き直す（入力中は描き直さない）。
     1分以内に取った中身はそのまま使う。同じ呼び出しが重なったら1回にまとめる。起動の中のお客様の情報は覚えない */
  var sentSchool = '';
  var FAST_FRESH = 60000, FAST_KEEP = 14 * 86400000, flying = {};
  /* LINEの人ごとに分けて覚える（入荷待ちの状態・前に選んだ学校など、その人だけの中身が混じるため） */
  function fastKey(name, args) { var pf = KS.line.profile(); return 'fast:' + ((pf && pf.userId) || '-') + ':' + name + ':' + JSON.stringify(args || {}); }
  function fastStrip(name, r) {
    if (name !== 'boot') return r;
    var x = {}; for (var k in r) if (k !== 'profile' && k !== 'now') x[k] = r[k];
    return x;
  }
  var fastGen = 0;   /* 申し込み・取り消しのたびに進める。それより前に出した読み込みの答えは覚えない */
  function fastClear() {
    fastGen++;
    var ks = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^ks_fast:[^:]*:(measureSlots|schoolItems|item):/.test(k)) ks.push(k.slice(3)); } } catch (e) { }
    ks.forEach(function (k) { ui.keep(k, null); });
  }
  /* 覚えた中身は写しを渡す（覚えた物そのものを書き換えないように） */
  function keptCopy(r) { var x = JSON.parse(JSON.stringify(r)); x._kept = true; return x; }
  function typing() { var a = document.activeElement; return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); }
  /* always：1分以内でも裏へ取りに行く（裏側で記録が残る呼び出し。例：選んだ学校を覚える schoolItems） */
  function fast(name, args, onFresh, always) {
    if (KS.config.backend !== 'gas') return call(name, args);
    var key = fastKey(name, args), hit = ui.keep(key);
    if (hit && !(hit.at > Date.now() - FAST_KEEP)) hit = null;
    if (hit && hit.at > Date.now() - FAST_FRESH && !flying[key] && !always) return Promise.resolve(keptCopy(hit.r));
    var fresh = flying[key];
    if (!fresh) {
      var hash = cur(), shown = hit ? JSON.stringify(hit.r) : '', gen = fastGen;
      fresh = flying[key] = call(name, args).then(function (r) {
        delete flying[key];
        if (r && r.ok && gen === fastGen) {
          var kept = fastStrip(name, r);
          ui.keep(key, { at: Date.now(), r: kept });
          if (onFresh) onFresh(r);
          /* 先に覚えた中身を出していて、新しい中身が違えば描き直す */
          if (shown && JSON.stringify(kept) !== shown && cur() === hash && !typing()) KS.app.render();
        }
        return r;
      });
    }
    if (!hit) return fresh;
    return Promise.resolve(keptCopy(hit.r));
  }
  /* 住所から、その画面が呼ぶものを起動と同時に呼んでおく */
  function prefetch(rest) {
    if (KS.config.backend !== 'gas') return;
    var k = rest[0] || '', id = rest[1];
    if (k === 'school' && !id) { fast('schools'); var ls = ui.keep('school'); if (ls) fast('schoolItems', { schoolId: ls }); }
    else if (k === 'school') fast('schoolItems', { schoolId: id });
    else if (k === 'item' && id) fast('item', { productId: id, cartId: cartId(), schoolId: lastSchool() });
    else if (k === 'measure' && id) fast('measureSlots', { schoolId: id });
    else if (k === 'measure') fast('measureSchools');
  }
  /* かごは取り置きを始めてから使う。始める前は呼ばない */
  function cartOf(b) { return b.stages.order ? call('cart', { cartId: cartId() }) : Promise.resolve({ ok: true, count: 0, goods: 0, lines: [] }); }
  function cartId() { return ui.cartId(); }
  function cur() { var h = location.hash.split('?')[0]; try { return decodeURIComponent(h); } catch (e) { return h; } }
  function seg(x) { return encodeURIComponent(x); }
  function go(path) { KS.app.go(path); return false; }
  /* 受付完了（C17）へは、確認の画面を置き換えて進む（端末の戻るで確認に戻って二重に申し込まないように） */
  function done(path) { KS.app.replace(path); return false; }
  function setFlash(path, kind, text) { flash = { hash: '#/' + decodeURIComponent(path.split('?')[0]), kind: kind, text: text }; }
  function shop() { return (B && B.shop) || { tel: TEL0, name: 'ココスポーツ', address: '', hours: '10:00〜18:00', closedText: '木曜・日曜は定休' }; }
  function telHref() { return 'tel:' + String(shop().tel || TEL0).replace(/[^0-9]/g, ''); }
  function telBtn(label, pri) { return '<a class="btn block' + (pri ? ' pri' : '') + '" href="' + telHref() + '">' + ico('tel') + esc(label || 'お店に電話する（' + shop().tel + '）') + '</a>'; }
  function yen(n) { return u.yen(n); }
  function when(date, start, end) { return u.jpDate(date) + ' ' + u.hm(start) + (end != null ? '〜' + u.hm(end) : ''); }
  function lastSchool() { return (B && B.profile && B.profile.schoolId) || ui.keep('school') || ''; }
  function left(ms) {
    ms = Math.max(0, ms);
    var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    if (h > 0) return h + '時間' + m + '分';
    return m + ':' + u.pad(s % 60);
  }
  function gcal(title, date, start, end) {
    var d = date.replace(/-/g, ''), f = function (m) { return d + 'T' + u.pad(Math.floor(m / 60)) + u.pad(m % 60) + '00'; };
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + seg(title) + '&dates=' + f(start) + '/' + f(end) + '&ctz=Asia%2FTokyo&location=' + seg(shop().name + ' ' + shop().address);
  }

  /* ================= 枠（見出し・下の帯・足もと） ================= */
  /* 戻る：back はその画面の親（アプリの中にひとつ前の画面が無いときの行き先）。
     ひとつ前の画面があれば history.back()（app.js の back）。up が付いた画面（受付完了・支払い）は、
     かごや確認に戻さないため、いつも親へ進む */
  function head(back, title, up) {
    if (!back) {
      return '<header class="c-hd"><div class="in"><a class="c-logo" href="#/c"><small>神栖市の制服・体操服と水素サロン</small><b>ココスポーツ</b></a>' +
        '<a class="c-tel" href="' + telHref() + '">' + ico('tel') + '電話</a></div><div class="lines"></div></header>';
    }
    return '<header class="c-hd"><div class="in"><a class="c-back" href="' + esc(back) + '"' + (up ? '' : ' data-act="cBack" data-to="' + esc(back) + '"') + '>' + ico('back') + '戻る</a><span class="c-ttl">' + esc(title || '') + '</span>' +
      '<a class="c-home" href="#/c" aria-label="はじめの画面へ">' + ico('home') + '</a></div><div class="lines"></div></header>';
  }
  function foot() {
    var s = shop();
    return '<footer class="c-foot"><nav><a href="#/c">はじめの画面</a><a href="#/c/my">わたしの予約</a><a href="#/c/rules">特定商取引法の表記・プライバシー・キャンセル</a></nav>' +
      '<p>' + esc(s.name) + '　' + esc(s.address) + '<br>' + esc(s.hours) + '（' + esc(s.closedText) + '）　<a href="' + telHref() + '">' + esc(s.tel) + '</a></p></footer>';
  }
  function flashHtml() { return flash && flash.hash === cur() ? '<div class="notice ' + flash.kind + '">' + esc(flash.text) + '</div>' : ''; }
  function steps(list, n) { return '<div class="steps">' + list.map(function (x, i) { return '<span class="' + (i < n ? 'on' : '') + '">' + (i + 1) + ' ' + esc(x) + '</span>'; }).join('') + '</div>'; }
  function page(o) {
    return head(o.back, o.title, o.up) + '<div class="c-body">' + (o.steps || '') + flashHtml() + o.body + '</div>' + foot() +
      (o.bar ? '<div class="actionbar">' + o.bar + '</div>' : '');
  }
  function sec(title, inner, cls) { return '<section class="c-sec' + (cls ? ' ' + cls : '') + '">' + (title ? '<h2>' + esc(title) + '</h2>' : '') + inner + '</section>'; }
  function choice(scope, k, v, curV, title, sub, dis) {
    return '<button type="button" class="choice' + (curV === v ? ' sel' : '') + '" data-act="cSet" data-s="' + scope + '" data-k="' + k + '" data-v="' + esc(v) + '"' + (dis ? ' disabled' : '') +
      '><span class="r"></span><span><b>' + esc(title) + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</span></button>';
  }
  function kv(rows) { return '<table class="sumtable">' + rows.filter(Boolean).map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + r[1] + '</td></tr>'; }).join('') + '</table>'; }
  function closedPage(back, title, text, extra) {
    return page({ back: back, title: title, body: '<div class="notice">' + esc(text) + '</div>' + (extra || '') + telBtn() });
  }
  /* まだ始めていない受付（設定 stages で外したもの）。料金表だけの間は、取り置きのボタンを押せない形で見せる */
  function openText(b, k) { return ((b && b.opening) || {})[k] || ''; }
  function priceOnly(b) { return !b.stages.order && !!b.stages.price; }
  function goodsShown(b) { return !!(b.stages.order || b.stages.price); }
  function soonPage(back, title, extra) {
    return page({ back: back, title: title, body: '<div class="c-empty">' + ico('clock', 'xl') + '<p><b>近日公開</b><br>' + esc(openText(B, 'soon') || '準備中です。') + '</p></div>' + (extra || '') + telBtn() });
  }
  function soonBar(b) { return '<div class="s">在庫の確認・お取り置き</div><button class="btn pri" disabled>' + esc(openText(b, 'orderShort') || '準備中') + '</button>'; }
  /* 予約（すぐ予約・来店して試着）を開けた学校か */
  function rsvOpen(b, sid) { return !!(b && b.stages.reserve && b.reserve && (b.reserve.schoolIds || []).indexOf(sid) >= 0); }
  function rsvNote(b) { return '<div class="notice">' + esc((b.reserve && b.reserve.handText) || '') + '</div>'; }
  /* 予約のかご（この端末の中だけ。送るときに裏側で品物と価格を確かめ直す） */
  function rsv() { var r = D.rsv || (D.rsv = { schoolId: '', lines: [] }); if (!r.lines) r.lines = []; return r; }
  function rsvCount() { return u.sum(rsv().lines, function (l) { return l.qty; }); }
  function rsvTotal() { return u.sum(rsv().lines, function (l) { return l.price * l.qty; }); }
  function rsvBar() {
    return rsvCount() ? '<div class="s">予約に ' + rsvCount() + '点<br>' + yen(rsvTotal()) + '</div><a class="btn pri" href="#/c/reserve">予約の確認へ' + ico('next') + '</a>' : '';
  }
  function soonNote(b) { return '<div class="notice">' + esc(openText(b, 'order') || '在庫の確認とお取り置きは準備中です。') + '</div>'; }

  /* ================= C90 困ったときの画面（画面遷移 v02 第4章） ================= */
  function c90(kind, o) {
    o = o || {};
    var inLine = !!(B && B.inLine), t, p, btns;
    if (kind === 'net') {
      t = '受け付けできませんでした'; p = '電波の良いところで、もう一度お試しください。つながらないときは、お電話でお受けします。';
      btns = '<button class="btn pri block" data-act="cRetry">もう一度試す</button>' + telBtn();
    } else if (kind === 'gone') {
      t = 'この予約はもうありません'; p = '取り消し済みか、リンクが古くなっています。ご不明な点はお電話でお問い合わせください。';
      btns = (inLine ? '<a class="btn pri block" href="#/c/my">わたしの予約を見る</a>' : '<a class="btn pri block" href="#/c">はじめの画面へ</a>') + telBtn();
    } else if (kind === 'expired' || kind === 'payStopped') {
      t = kind === 'payStopped' ? 'お支払いをやめました' : '期限が切れました';
      p = o.msg || 'お支払いの期限が過ぎたため、取り置きを取り消しました。';
      if (kind === 'payStopped') p = 'お支払いが済んでいないため、取り置きを取り消しました。同じ品をもう一度選び直せます。';
      btns = (D.lastOrder && D.lastOrder.lines && D.lastOrder.lines.length ? '<button class="btn pri block" data-act="cReAdd">同じ品をかごに入れ直す</button>' : '') +
        '<a class="btn block" href="#/c/cart">かごを見る</a>';
    } else if (kind === 'notfound') {
      t = 'ページが見つかりません'; p = o.msg || 'リンクが古いか、まちがっているかもしれません。';
      btns = '<a class="btn pri block" href="#/c">はじめの画面へ</a>';
    } else {
      t = kind === 'closed' ? '準備中です' : 'うまくいきませんでした'; p = o.msg || 'もう一度お試しください。';
      btns = '<a class="btn pri block" href="#/c">はじめの画面へ</a>' + telBtn();
    }
    return page({ back: '#/c', title: '', body: '<div class="c-trouble"><h1>' + esc(t) + '</h1><p>' + esc(p) + '</p></div>' + btns });
  }
  /* 画面を描くときの ok:false */
  function bad(r) {
    if (r.code === 'network' || r.code === 'error') return c90('net');
    if (r.code === 'gone') return c90('gone');
    if (r.code === 'expired') return c90('expired', { msg: r.message });
    if (r.code === 'notfound') return c90('notfound', { msg: r.message });
    if (r.code === 'closed') return c90('closed', { msg: r.message });
    return c90('other', { msg: r.message });
  }
  /* 操作の ok:false（その住所に C90 を出すか、短いお知らせ） */
  function actFail(r) {
    var h = cur();
    if (r.code === 'network' || r.code === 'error') { trouble = { hash: h, kind: 'net' }; return; }
    if (r.code === 'gone') { trouble = { hash: h, kind: 'gone' }; return; }
    if (r.code === 'expired') { trouble = { hash: h, kind: 'expired', msg: r.message }; return; }
    ui.toast(r.message || 'うまくいきませんでした');
  }

  /* ================= C00 はじめの画面 ================= */
  function c00(r, p, b) {
    var s = b.shop, st = b.stages, last = lastSchool();
    var tasks = [
      ['#/c/school' + (last ? '/' + seg(last) : ''), 'shirt', st.order ? '体操服・制服' : rsvNames(b) ? '体操服の料金表・ご予約' : '体操服の料金表', st.order ? '学校を選んで、サイズと在庫を見る・取り置き' : rsvNames(b) ? '学校を選んで価格を見る。' + rsvNames(b) + 'はご予約を受付中' : st.price ? '学校を選んで、品物とサイズごとの価格を見る' : '近日公開'],
      ['#/c/salon', 'drop', '水素サロン', st.salon || s.airReserve ? '完全個室・2席。空いている時間を見て予約' : 'ご予約はお電話で'],
      ['#/c/my', 'list', 'わたしの予約', st.order || st.salon || st.measure || st.reserve ? 'ご予約の確認と取り消し' : '近日公開']
    ];
    var hol = (b.holidays || []).filter(function (h) { return h.date <= u.addDays(b.today, 30); });
    var body = '<section class="c-intro"><div class="en">KOKO SPORTS</div><h1 class="mincho">制服・体操服と、<br>水素サロンのお店</h1>' +
      '<p>神栖二中・神栖四中の制服と体操服、息栖小・深芝小・大野原小・大野原西小の体操服を扱っています。</p></section>' +
      (priceOnly(b) ? (rsvNames(b) ? rsvNote(b) : soonNote(b)) : '') +
      '<nav class="c-tasks">' + tasks.map(function (t) {
        return '<a href="' + t[0] + '">' + ico(t[1], 'lg') + '<span><b>' + esc(t[2]) + '</b><small>' + esc(t[3]) + '</small></span>' + ico('next') + '</a>';
      }).join('') + '</nav>' +
      (st.measure ? '<a class="c-sublink" href="#/c/measure">' + ico('ruler') + '中学校の制服の採寸を予約する' + ico('next') + '</a>' : '') +
      '<div class="ttl"><div class="e">Shop</div><div class="j">お店の情報</div></div>' +
      kv([
        ['営業時間', esc(s.hours)],
        ['定休日', esc(s.closedText)],
        hol.length ? ['臨時休業', hol.map(function (h) { return esc(u.jpDate(h.date)) + (h.reason ? '<span class="t2">　' + esc(h.reason) + '</span>' : ''); }).join('<br>')] : null,
        ['住所', esc(s.address) + '<br><a class="c-link" href="' + esc(s.map) + '" target="_blank" rel="noopener">' + ico('pin') + '地図を開く</a>'],
        ['電話', '<a class="c-link" href="' + telHref() + '">' + esc(s.tel) + '</a>'],
        ['Instagram', '<a class="c-link" href="' + esc(s.instagram) + '" target="_blank" rel="noopener">' + ico('insta') + '@_kokosports</a>']
      ]) +
      (b.inLine ? '' : '<p class="help">公式LINEで友だちになると、受付の確認や入荷のお知らせがLINEに届きます。<a class="c-link" href="' + esc(s.lineAddUrl) + '" target="_blank" rel="noopener">友だちになる</a></p>');
    return head() + '<div class="c-body">' + flashHtml() + body + '</div>' + foot();
  }

  /* 予約を開けた学校の短い名前（「大野原小・大野原西小」） */
  function rsvNames(b) {
    var ids = (b.reserve && b.stages.reserve && b.reserve.schoolIds) || [], names = { onohara: '大野原小', onoharanishi: '大野原西小', ikisu: '息栖小', fukashiba: '深芝小' };
    return ids.map(function (x) { return names[x] || x; }).join('・');
  }

  /* ================= C01 LINEで続ける案内 ================= */
  function c01(next) {
    var s = shop(), liff = !!KS.config.liffId;
    var body = '<div class="c-lineguide">' + ico('line', 'xl') + '<h1 class="mincho">LINEで続けると、<br>次から入力が楽です</h1>' +
      '<ul><li>お名前と電話番号を、次から入れておきます</li><li>受付の確認・前日・入荷のお知らせが、LINEに届きます</li><li>「わたしの予約」で、ご予約をまとめて見られます</li></ul></div>' +
      (liff ? '<button class="btn pri block" data-act="cLineOpen" data-next="' + esc(next) + '">' + ico('line') + 'LINEで開く</button>'
        : '<a class="btn pri block" href="' + esc(s.lineAddUrl) + '" target="_blank" rel="noopener">' + ico('line') + 'LINEで友だちになる</a>') +
      '<button class="btn block" data-act="cLineSkip" data-next="' + esc(next) + '">このまま続ける</button>' +
      '<p class="help">LINEを使わなくても、電話番号とメールアドレスで最後までご予約できます。確認はメールでお送りします。</p>';
    return page({ back: '#/c', title: 'ご案内', body: body });
  }

  /* ================= C10 学校を選ぶ ================= */
  function c10(r, p, b) {
    if (!goodsShown(b)) return soonPage('#/c', '体操服・制服');
    return fast('schools').then(function (res) {
      if (!res.ok) return bad(res);
      var last = ui.keep('school') || res.lastSchoolId || '';   /* この端末で最後に選んだ学校を先に（覚えた一覧の lastSchoolId は古いことがある） */
      var known = res.schools.filter(function (s) { return s.id === last; })[0];
      if (known && p.pick !== '1') { KS.app.replace('#/c/school/' + seg(last)); return ui.loading(); }
      var row = function (s) { return '<a href="#/c/school/' + seg(s.id) + '">' + esc(s.name) + '<span>' + (s.kind === '中' ? '制服・体操服' : '体操服') + ico('next') + '</span></a>'; };
      var body = '<p class="c-lead">お子さまの学校を選んでください。その学校で使う品と、サイズごとの' + (b.stages.order ? '在庫' : '価格') + 'が見られます。</p>' +
        (known ? '<div class="schools"><div class="g">前に選んだ学校</div>' + row(known) + '</div>' : '') +
        '<div class="schools">' + (res.schools.some(function (s) { return s.kind === '中'; }) ? '<div class="g">中学校（制服・体操服）</div>' + res.schools.filter(function (s) { return s.kind === '中'; }).map(row).join('') : '') +
        '<div class="g">小学校（体操服）</div>' + res.schools.filter(function (s) { return s.kind !== '中'; }).map(row).join('') + '</div>' +
        '<p class="help">ほかの学校の品は、お電話でお問い合わせください。</p>';
      return page({ back: '#/c', title: '学校を選ぶ', body: body });
    });
  }

  /* ================= C11 学校の品物 ================= */
  var MARK = { 'あり': '在庫あり', '残りわずか': '残りわずか', '品切れ': '品切れ', '採寸': '採寸してから' };
  function markCls(m) { return m === '残りわずか' ? 'low' : m === '品切れ' ? 'out' : m === '採寸' ? 'msr' : ''; }
  function c11(r, p, b) {
    if (!goodsShown(b)) return soonPage('#/c', '体操服・制服');
    var po = priceOnly(b);
    var sid = r[0], ro = rsvOpen(b, sid) && !b.stages.order;   /* 予約は取り置き（在庫を見て買う）を始める前の形。始めたら通常の取り置きに戻る */
    var pick = sentSchool !== sid; sentSchool = sid;   /* 学校を選び直したときは、裏側にも必ず届ける（その人の学校として覚える） */
    return Promise.all([fast('schoolItems', { schoolId: sid }, null, pick), cartOf(b)]).then(function (x) {
      var res = x[0], cr = x[1];
      if (!res.ok) return bad(res);
      ui.keep('school', sid);
      var s = res.school;
      var item = function (it) {
        if (it.needsMeasure) return '<a class="c-item" href="#/c/item/' + seg(it.id) + '"><span class="n">' + esc(it.name) + '</span><span class="r"><span class="mk">サイズ・価格は採寸のあと</span></span></a>';
        var pr = it.priceTentative ? '<span class="mk">価格は近日掲載</span>' : '<span class="pr">' + yen(it.price) + (it.priceFrom ? '〜' : '') + '</span>';
        return '<a class="c-item" href="#/c/item/' + seg(it.id) + '"><span class="n">' + esc(it.name) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</span>' +
          '<span class="r">' + pr + (po || ro ? '' : '<span class="mk ' + markCls(it.state) + '">' + esc(MARK[it.state] || it.state) + '</span>') + '</span></a>';
      };
      var need = res.items.filter(function (i) { return i.required && !i.needsMeasure; }), opt = res.items.filter(function (i) { return !i.required; });
      var msr = res.items.filter(function (i) { return i.needsMeasure; });
      var measure = '';
      if (s.measure) {
        measure = res.measureOpen
          ? '<div class="c-box">' + ico('ruler', 'lg') + '<div><b>制服は採寸が必要です</b><p>サイズを測ってからご用意します。採寸の日程から、ご都合の良い時間を選んでください。</p><a class="btn sm" href="#/c/measure/' + seg(s.id) + '">採寸を予約' + ico('next') + '</a></div></div>'
          : '<div class="notice">制服は採寸してからご用意します。採寸のご予約は準備中です。お電話でお問い合わせください。</div>';
      }
      var gift = res.campaign ? '<div class="c-box c-gift">' + ico('star', 'lg') + '<div>' + (res.campaign.title ? '<b>' + esc(res.campaign.title) + '</b>' : '') +
        '<ul>' + String(res.campaign.text).split('\n').filter(function (x) { return x.trim(); }).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div></div>' : '';
      var routes = ro ? sec('ご予約の方法', '<div class="c-routes">' +
          '<a href="#/c/school/' + seg(s.id) + '" data-act="cJump" data-to="c-items">' + ico('bag', 'lg') + '<span><b>すぐ予約する</b><small>下の品物からサイズを選んで、このまま予約</small></span>' + ico('next') + '</a>' +
          '<a href="#/c/measure/' + seg(s.id) + '">' + ico('cal', 'lg') + '<span><b>来店して試着してから</b><small>試着の日時を予約（30分）。試着のあと、お店でご予約</small></span>' + ico('next') + '</a></div>' +
          rsvNote(b) + '<p class="help">お支払いは、お渡しのときに店頭で。</p>') : '';
      var body = '<div class="c-pagehd"><h1>' + esc(s.name) + '</h1><a class="c-link" href="#/c/school?pick=1">学校を変える</a></div>' + (ro ? routes : po ? soonNote(b) : '') + measure + gift +
        (res.items.length
          ? '<div id="c-items"></div>' + (need.length ? sec(ro ? 'そろえる品（ご予約できます）' : po ? 'そろえる品' : 'そろえる品（取り置きできます）', '<div class="c-items">' + need.map(item).join('') + '</div>') : '') +
            (msr.length ? sec('制服（採寸してからご用意します）', '<div class="c-items">' + msr.map(item).join('') + '</div>') : '') +
            (opt.length ? sec('あると便利', '<div class="c-items">' + opt.map(item).join('') + '</div>') : '') +
            '<p class="help">価格は税込みです。「〜」はサイズによって価格が変わる品です。' + (ro ? '品物を押して、サイズを選ぶと予約に入れられます。「価格は近日掲載」の品は、価格が決まってからご予約できます。' : po ? '品物を押すと、サイズごとの価格が見られます。' : '「残りわずか」「品切れ」はネットと店頭を合わせた在庫です。') + '</p>'
          : '<div class="notice">この学校の品物は準備中です。お電話でお問い合わせください。</div>' + telBtn() + '<a class="btn block" href="#/c/school?pick=1">扱っている学校を見る</a>');
      var bar = ro ? rsvBar() : po ? soonBar(b) : cr.ok && cr.count ? '<div class="s">かごに ' + cr.count + '点<br>' + yen(cr.goods) + '</div><a class="btn pri" href="#/c/cart">' + ico('bag') + 'かごを見る</a>' : '';
      return page({ back: '#/c/school?pick=1', title: s.short, body: body, bar: bar });
    });
  }

  /* ================= C12 品物とサイズ ================= */
  function guideTable(g) {
    if (!g) return '';
    var rows = g.split('／').map(function (x) { var q = x.split('：'); return [q[0], q[1] || '']; });
    return '<details class="c-guide"><summary>サイズの目安</summary><table class="sizetable"><tr><th>サイズ</th><th>目安</th></tr>' +
      rows.map(function (q) { return '<tr><td>' + esc(q[0]) + '</td><td>' + esc(q[1]) + '</td></tr>'; }).join('') + '</table>' +
      '<p class="help">体格によって合うサイズは変わります。迷ったら店頭で試着できます。</p></details>';
  }
  function qtyBox(act, attrs, q) {
    return '<div class="qty"><button type="button" data-act="' + act + '" ' + attrs + ' data-d="-1" aria-label="1つ減らす"' + (q <= 1 ? ' disabled' : '') + '>' + ico('minus') + '</button>' +
      '<span>' + q + '</span><button type="button" data-act="' + act + '" ' + attrs + ' data-d="1" aria-label="1つ増やす"' + (q >= 9 ? ' disabled' : '') + '>' + ico('plus') + '</button></div>';
  }
  function c12(r, p, b) {
    if (!goodsShown(b)) return soonPage('#/c', '体操服・制服');
    var pid = r[0];
    return Promise.all([fast('item', { productId: pid, cartId: cartId(), schoolId: lastSchool() }), cartOf(b)]).then(function (x) {
      var res = x[0], cr = x[1];
      if (!res.ok) return bad(res);
      var pr = res.product, sc = res.school, sel = dr('sel')[pid] || {};
      var size = p.size && pr.sizes.indexOf(p.size) >= 0 ? p.size : (sel.size || '');
      var qty = sel.qty || 1;
      var back = sc ? '#/c/school/' + seg(sc.id) : '#/c/school';
      var cell = res.sizes.filter(function (z) { return z.size === size; })[0];
      /* 価格：サイズを選んだらそのサイズの価格。選ぶ前は「2,300円〜3,300円」 */
      var priceHtml = pr.priceTentative && !pr.needsMeasure ? '価格は近日掲載<small>（店頭でご案内します）</small>'
        : !pr.price && !res.priceMax ? '価格は採寸のあとご案内します'
        : cell && !pr.needsMeasure ? yen(cell.price) + '<small>（' + esc(cell.label) + '・税込み）</small>'
        : res.priceFrom ? yen(res.priceMin) + '〜' + yen(res.priceMax) + '<small>（サイズによって変わります・税込み）</small>'
        : yen(res.priceMin) + '<small>（税込み）</small>';
      var info = '<div class="c-prod"><div class="sc">' + esc(sc ? sc.name : pr.forKind === '小' ? '小学校共通' : '各学校共通') + '・' + esc(pr.cat) + '</div><h1>' + esc(pr.name) + '</h1>' +
        '<div class="pr">' + priceHtml + '</div>' + (pr.note ? '<p class="help">' + esc(pr.note) + '</p>' : '') + '</div>';
      if (pr.photo) info = '<div class="photo c-photo" style="background-image:url(\'' + esc(pr.photo) + '\')"></div>' + info;
      if (pr.needsMeasure) {
        var body0 = info + '<div class="c-box">' + ico('ruler', 'lg') + '<div><b>この品は採寸してからご用意します</b><p>かごには入れられません。採寸のときに、サイズとお受け取りの日をご案内します。</p>' +
          (b.stages.measure && sc ? '<a class="btn sm" href="#/c/measure/' + seg(sc.id) + '">採寸を予約' + ico('next') + '</a>' : '') + '</div></div>' +
          '<p class="help">サイズ：' + res.sizes.map(function (z) { return esc(z.label); }).join('・') + '</p>' + (b.stages.measure ? '' : telBtn());
        return page({ back: back, title: '品物とサイズ', body: body0 });
      }
      /* 予約を開けた学校：サイズを選んで予約に入れる（在庫は出さない） */
      if (res.reserveOpen && !b.stages.order) {
        var rsizes = '<div class="sizes c-sizes priced">' + res.sizes.map(function (z) {
          return '<button type="button" class="' + (size === z.size ? 'sel' : '') + '" data-act="cSize" data-pid="' + esc(pid) + '" data-v="' + esc(z.size) + '">' + esc(z.label) + '<em>' + yen(z.price) + '</em></button>';
        }).join('') + '</div>';
        var rcell = res.sizes.filter(function (z) { return z.size === size; })[0];
        var rbody = info + rsvNote(b) + sec('サイズ', rsizes + (rcell ? '<div class="c-qtyrow"><span>数</span>' + qtyBox('cSelQty', 'data-pid="' + esc(pid) + '"', qty) + '</div>' : '<p class="help">サイズを選んでください。迷ったら「来店して試着」もご予約できます。</p>')) +
          guideTable(pr.sizeGuide) + (rsvCount() ? '<a class="c-cartlink" href="#/c/reserve">' + ico('bag') + '予約に ' + rsvCount() + '点 入っています<span>予約の確認へ' + ico('next') + '</span></a>' : '');
        var rbar = rcell ? '<div class="s">' + esc(rcell.label) + '・' + qty + '点<br>' + yen(rcell.price * qty) + '</div><button class="btn pri" data-act="cRsvAdd" data-pid="' + esc(pid) + '" data-size="' + esc(rcell.size) + '" data-label="' + esc((sc ? sc.short + ' ' : '') + pr.name + '（' + rcell.label + '）') + '" data-price="' + rcell.price + '" data-school="' + esc(res.reserveSchoolId) + '">' + ico('bag') + '予約に入れる</button>'
          : '<div class="s">サイズを選んでください</div><button class="btn pri" disabled>予約に入れる</button>';
        return page({ back: back, title: '品物とサイズ', body: rbody, bar: rbar });
      }
      /* 料金表だけの間：サイズと価格の表。在庫・かごは出さない */
      if (priceOnly(b)) {
        var tbl = pr.priceTentative ? '<p class="help">サイズ：' + res.sizes.map(function (z) { return esc(z.label); }).join('・') + '</p>'
          : '<table class="sizetable"><tr><th>サイズ</th><th>価格（税込み）</th></tr>' + res.sizes.map(function (z) { return '<tr><td>' + esc(z.label) + '</td><td>' + yen(z.price) + '</td></tr>'; }).join('') + '</table>';
        return page({ back: back, title: '品物とサイズ', body: info + soonNote(b) + sec(pr.priceTentative ? 'サイズ' : 'サイズと価格', tbl) + guideTable(pr.sizeGuide), bar: soonBar(b) });
      }
      var allOut = res.sizes.every(function (z) { return z.state === '品切れ'; });
      var sizes = '<div class="sizes c-sizes' + (res.priceFrom ? ' priced' : '') + '">' + res.sizes.map(function (z) {
        return '<button type="button" class="' + (size === z.size ? 'sel ' : '') + markCls(z.state) + '" data-act="cSize" data-pid="' + esc(pid) + '" data-v="' + esc(z.size) + '">' +
          esc(z.label) + (res.priceFrom ? '<em>' + yen(z.price) + '</em>' : '') + '<small>' + (z.state === 'あり' ? 'あり' : z.state === '残りわずか' ? 'わずか' : '品切れ') + '</small></button>';
      }).join('') + '</div>';
      var state = '';
      if (cell) {
        if (cell.state === '品切れ') state = cell.waiting ? '<div class="notice">このサイズは品切れです。入荷のお知らせに登録済みです。入荷したらお知らせします。</div>'
          : '<div class="notice">このサイズは品切れです。入荷したら、早い順にお知らせします。</div>';
        else state = '<div class="c-state">' + esc(cell.label) + '：' + (cell.state === '残りわずか' ? '残りわずかです' : '在庫があります') + '</div><div class="c-qtyrow"><span>数</span>' + qtyBox('cSelQty', 'data-pid="' + esc(pid) + '"', qty) + '</div>';
      }
      var body = info + (allOut ? '<div class="notice warn">いま、すべてのサイズが品切れです。サイズを選ぶと、入荷のお知らせに登録できます。</div>' : '') +
        sec('サイズ', sizes + (cell ? '' : '<p class="help">サイズを選んでください。数はお出ししていません。</p>') + state) + guideTable(pr.sizeGuide) +
        (cr.ok && cr.count ? '<a class="c-cartlink" href="#/c/cart">' + ico('bag') + 'かごに ' + cr.count + '点 入っています<span>かごを見る' + ico('next') + '</span></a>' : '');
      var bar;
      if (!cell) bar = '<div class="s">サイズを選んでください</div><button class="btn pri" disabled>かごに入れる</button>';
      else if (cell.state === '品切れ') bar = cell.waiting ? '<div class="s">' + esc(cell.label) + '：入荷待ちに登録済み</div><a class="btn" href="' + back + '">ほかの品を見る</a>'
        : '<div class="s">' + esc(cell.label) + '：品切れ</div><a class="btn pri" href="#/c/wait/' + seg(pid) + '/' + seg(cell.size) + '">' + ico('bell') + '入荷したら知らせる</a>';
      else bar = '<div class="s">' + esc(cell.label) + '・' + qty + '点<br>' + yen(cell.price * qty) + '</div><button class="btn pri" data-act="cAdd" data-pid="' + esc(pid) + '" data-size="' + esc(cell.size) + '">' + ico('bag') + 'かごに入れる</button>';
      return page({ back: back, title: '品物とサイズ', body: body, bar: bar });
    });
  }

  /* ================= C13 かご ================= */
  function c13(r, p, b) {
    return call('cart', { cartId: cartId() }).then(function (res) {
      if (!res.ok) return bad(res);
      var last = lastSchool(), more = '#/c/school' + (last ? '/' + seg(last) : '');
      /* 前に見たかごの品が、期限を過ぎて消えていたら案内する（裏側の5分ごとの処理が先に外すことがあるため） */
      var gone = (res.expired || []).slice(), seen = D.cartSeen;
      if (seen && res.now >= seen.exp) seen.labels.forEach(function (l) { if (gone.indexOf(l) < 0 && !res.lines.some(function (x) { return x.label === l; })) gone.push(l); });
      D.cartSeen = res.lines.length ? { labels: res.lines.map(function (l) { return l.label; }), exp: res.expiresAt } : null; saveDraft();
      var exp = gone.length ? '<div class="notice warn">30分たったため、かごから外しました：' + gone.map(esc).join('、') + '。在庫があれば、もう一度選べます。</div>' : '';
      if (!res.lines.length) {
        return page({
          back: more, title: 'かご', steps: steps(ORDER_STEPS, 1),
          body: exp + '<div class="c-empty">' + ico('bag', 'xl') + '<p>かごは空です</p></div><a class="btn pri block" href="' + more + '">品物を選ぶ</a>'
        });
      }
      var untilLocal = Date.now() + (res.expiresAt - res.now);
      var lines = res.lines.map(function (l) {
        return '<div class="c-line"><div class="n">' + esc(l.label) + '<small>' + yen(l.price) + ' × ' + l.qty + '点</small></div>' +
          '<div class="r"><b>' + yen(l.price * l.qty) + '</b>' + qtyBox('cQty', 'data-hold="' + esc(l.holdId) + '" data-q="' + l.qty + '"', l.qty) +
          '<button type="button" class="linkbtn" data-act="cQty" data-hold="' + esc(l.holdId) + '" data-q="' + l.qty + '" data-d="-99">外す</button></div></div>';
      }).join('');
      var body = exp + '<div class="c-timer">' + ico('clock') + '<span>あと <b data-until="' + untilLocal + '" data-reload="1">' + left(untilLocal - Date.now()) + '</b> 在庫を押さえています。過ぎるとかごから外れます。</span></div>' +
        '<div class="c-lines">' + lines + '</div>' + kv([['品物の代金', '<b>' + yen(res.goods) + '</b>（' + res.count + '点）']]) +
        '<a class="btn block" href="' + more + '">' + ico('plus') + '続けて選ぶ</a>';
      return page({
        back: more, title: 'かご', steps: steps(ORDER_STEPS, 1), body: body,
        bar: '<div class="s">' + res.count + '点<br>' + yen(res.goods) + '</div><a class="btn pri" href="#/c/checkout">受け取り方へ' + ico('next') + '</a>'
      });
    });
  }

  /* ================= C14 受け取り方と連絡先 ================= */
  function dayGrid(days, sel, err) {
    var cells = u.WD.map(function (w, i) { return '<span class="wd' + (i === 6 ? ' sat' : i === 0 ? ' sun' : '') + '">' + w + '</span>'; }).join('');
    for (var i = 0; i < u.wd(days[0].date); i++) cells += '<span></span>';
    days.forEach(function (d) {
      var dt = u.parse(d.date), lab = (dt.getMonth() + 1) + '/' + dt.getDate();
      cells += d.open ? '<button type="button" class="' + (sel === d.date ? 'sel' : '') + '" data-act="cSet" data-s="co" data-k="pickupDate" data-v="' + d.date + '" aria-label="' + esc(u.jpDate(d.date)) + '">' + lab + '</button>'
        : '<span class="off" title="' + esc(d.why) + '">' + lab + '<small>休</small></span>';
    });
    return '<div class="c-days">' + cells + '</div>' + (err ? '<div class="errtxt">' + esc(err) + '</div>' : '');
  }
  function checkCo(co, inLine, count, ship) {
    var e = {};
    if (co.method === '配送') {
      var m = ship && ship.methods.filter(function (x) { return x.id === co.shipMethod; })[0];
      if (!m) e.shipMethod = '送り方を選んでください。';
      else if (count > m.maxItems) e.shipMethod = 'この送り方は' + m.maxItems + '点までです。';
      if (!u.okZip(co.zip)) e.zip = '郵便番号を7桁で入力してください。';
      if (!String(co.addr || '').trim()) e.addr = '住所を入力してください。';
    } else if (!co.pickupDate) e.pickupDate = '受け取りの日を選んでください。';
    if (!String(co.name || '').trim()) e.name = 'お名前を入力してください。';
    if (!u.okPhone(co.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!inLine && !u.okEmail(co.email)) e.email = 'メールアドレスをご確認ください。確認のお知らせをお送りします。';
    return e;
  }
  function prepCo(res) {
    var co = dr('co');
    if (!co._filled && res.profile && res.profile.inLine) {
      ['name', 'kana', 'phone', 'email'].forEach(function (k) { if (!co[k] && res.profile[k]) co[k] = res.profile[k]; });
    }
    co._filled = 1;
    if (!co.method || (co.method === '配送' && !res.ship)) co.method = '店頭';
    if (co.pickupDate && !res.days.some(function (d) { return d.date === co.pickupDate && d.open; })) co.pickupDate = '';
    if (!res.prepay || co.method === '配送') co.pay = co.method === '配送' ? '事前' : '店頭';
    if (!co.pay) co.pay = '店頭';
    saveDraft();
    return co;
  }
  function c14(r, p, b) {
    if (!b.stages.order) return soonPage('#/c', '受け取り方');
    return call('checkoutInfo', { cartId: cartId() }).then(function (res) {
      if (!res.ok) return bad(res);
      if (!res.cart.lines.length) { setFlash('c/cart', 'warn', 'かごが空になっています。品物を選び直してください。'); KS.app.replace('#/c/cart'); return ui.loading(); }
      var co = prepCo(res), e = errs.co || {}, inLine = res.profile.inLine, cnt = res.cart.count;
      nextFormKey = 'co';
      var how = choice('co', 'method', '店頭', co.method, 'お店で受け取る', '営業日のお好きな日に。取り置きは受け取り日から' + res.keepDays + '日間です。') +
        (res.ship ? choice('co', 'method', '配送', co.method, 'ご自宅に届ける', '送料 ' + yen(Math.min.apply(null, res.ship.methods.map(function (m) { return m.fee; }))) + '〜。お支払いはネットで先に（カード）。') : '');
      var detail;
      if (co.method === '配送') {
        detail = sec('送り方', res.ship.methods.map(function (m) {
          var over = cnt > m.maxItems;
          return choice('co', 'shipMethod', m.id, co.shipMethod, m.name + '　' + yen(m.fee), over ? m.maxItems + '点までのため、今回は選べません' : '', over);
        }).join('') + (e.shipMethod ? '<div class="errtxt">' + esc(e.shipMethod) + '</div>' : '')) +
          sec('届け先', ui.field('zip', '郵便番号（7桁）', { req: 1, value: co.zip, err: e.zip, mode: 'numeric', ac: 'postal-code', ph: '3140000' }) +
            ui.field('addr', '住所', { req: 1, value: co.addr, err: e.addr, ac: 'street-address', ph: '茨城県神栖市…' }) +
            ui.field('shipName', '届け先のお名前', { req: false, value: co.shipName, ph: 'ご本人と違うときだけ', help: '空のときは、下の「お名前」あてにお送りします。' }) +
            '<p class="help">お支払いを確かめてから発送します。</p>');
      } else {
        detail = sec('受け取りの日', dayGrid(res.days, co.pickupDate, e.pickupDate) +
          '<p class="help">' + esc(res.shop.hours) + '。' + esc(res.shop.closedText) + '。「休」の日は選べません。</p>') +
          (res.prepay ? sec('お支払い', choice('co', 'pay', '店頭', co.pay, '受け取りのときに店頭で', '現金・カード・電子マネーなど') +
            choice('co', 'pay', '事前', co.pay, '先にネットで払う', 'カードで。受け取りのときのお会計がいりません。')) : '');
      }
      var contact = sec('連絡先',
        ui.field('name', 'お名前', { req: 1, value: co.name, err: e.name, ac: 'name', ph: '山田 花子' }) +
        ui.field('kana', 'フリガナ', { req: false, value: co.kana, ac: 'off', ph: 'ヤマダ ハナコ' }) +
        ui.field('phone', '電話番号', { req: 1, value: co.phone, err: e.phone, type: 'tel', mode: 'tel', ac: 'tel', ph: '090-1234-5678', help: 'お受け取りのことで、お店から連絡することがあります。' }) +
        (inLine ? '<p class="help">受付の確認は、LINEでお送りします。</p>'
          : ui.field('email', 'メールアドレス', { req: 1, value: co.email, err: e.email, type: 'email', mode: 'email', ac: 'email', ph: 'hanako@example.jp', help: '受付の確認と、ご予約の確認・取り消しのリンクをお送りします。' })) +
        ui.field('note', 'お店への連絡', { req: false, textarea: 1, value: co.note, ph: '例：サイズを店頭で試してから受け取りたい' }));
      return page({
        back: '#/c/cart', title: '受け取り方と連絡先', steps: steps(ORDER_STEPS, 2),
        body: sec('受け取り方', how) + detail + contact,
        bar: '<div class="s">' + cnt + '点<br>' + yen(res.cart.goods) + '</div><button class="btn pri" data-act="cCoNext">確認へ' + ico('next') + '</button>'
      });
    });
  }

  /* ================= C15 最後の確認 ================= */
  function c15(r, p, b) {
    return call('checkoutInfo', { cartId: cartId() }).then(function (res) {
      if (!res.ok) return bad(res);
      if (!res.cart.lines.length) { setFlash('c/cart', 'warn', 'かごが空になっています。品物を選び直してください。'); KS.app.replace('#/c/cart'); return ui.loading(); }
      var co = prepCo(res), inLine = res.profile.inLine;
      if (Object.keys(checkCo(co, inLine, res.cart.count, res.ship)).length) { KS.app.replace('#/c/checkout'); return ui.loading(); }
      nextFormKey = 'co';
      var ship = co.method === '配送' ? res.ship.methods.filter(function (m) { return m.id === co.shipMethod; })[0] : null;
      var fee = ship ? ship.fee : 0, prepay = co.method === '配送' || co.pay === '事前';
      var ret = String(res.legal.tokushoho || '').split('\n').filter(function (l) { return /^返品/.test(l); })[0] || '';
      var rows = [
        ['品物', res.cart.lines.map(function (l) { return esc(l.label) + '　×' + l.qty + '<span class="t2">　' + yen(l.price * l.qty) + '</span>'; }).join('<br>')],
        ['品物の代金', yen(res.cart.goods)],
        ['送料', ship ? yen(fee) : 'かかりません（店頭で受け取り）'],
        ['合計', '<b>' + yen(res.cart.goods + fee) + '</b>（税込み）'],
        ['受け取り', ship ? '配送：' + esc(ship.name) + '<br>〒' + esc(u.normPhone(co.zip)) + ' ' + esc(co.addr) + '<br>' + esc(co.shipName || co.name) + ' 様'
          : 'お店で ' + esc(u.jpDate(co.pickupDate)) + '<br><span class="t2">' + esc(res.shop.hours) + '</span>'],
        ship ? ['発送', 'お支払いを確かめてから発送します'] : ['取り置きの期限', esc(u.jpDate(u.addDays(co.pickupDate, res.keepDays))) + ' まで<br><span class="t2">過ぎると取り置きを取り消し、在庫に戻します。</span>'],
        ['お支払い', prepay ? '先にネットで（カード）<br><span class="t2">次の画面でお支払いください。' + res.payDeadlineMin + '分以内にお支払いがないと、' + (ship ? 'ご注文' : '取り置き') + 'は取り消しになります。</span>' : '受け取りのときに店頭で'],
        ['お名前', esc(co.name) + (co.kana ? '（' + esc(co.kana) + '）' : '')],
        ['電話番号', esc(co.phone)],
        inLine ? ['確認の連絡', 'LINEでお送りします'] : ['メール', esc(co.email)],
        co.note ? ['お店への連絡', ui.br(co.note)] : null
      ];
      var e = errs.confirm || {};
      var body = kv(rows) +
        sec('取り消しの決まり', '<p class="c-rule">' + ui.br(res.legal.cancel) + '</p>' + (ret ? '<p class="c-rule">' + esc(ret) + '</p>' : '') +
          '<a class="c-link" href="#/c/rules">特定商取引法に基づく表記・プライバシーポリシー</a>') +
        ui.check('agree', '上の内容と、取り消し・返品の決まりを確かめました', { value: co.agree, err: e.agree });
      return page({
        back: '#/c/checkout', title: '最後の確認', steps: steps(ORDER_STEPS, 3), body: body,
        bar: '<div class="s">合計<br>' + yen(res.cart.goods + fee) + '</div><button class="btn pri" data-act="cPlace">' + (prepay ? 'お支払いへ進む' : 'この内容で申し込む') + '</button>'
      });
    });
  }

  /* ================= C16 支払い ================= */
  function c16(r, p, b) {
    var token = r[0];
    return call('orderDone', { token: token }).then(function (res) {
      if (!res.ok) return bad(res);
      var o = res.order;
      if (o.payStatus !== '支払い待ち') { KS.app.replace('#/c/done/order/' + seg(token)); return ui.loading(); }
      var body = '<div class="paybox"><div class="t2">' + esc(shop().name) + ' へのお支払い</div><div class="c-amount">' + yen(o.total) + '</div>' +
        kv([['受付番号', esc(o.id)], ['品物', o.lines.map(function (l) { return esc(l.label) + ' ×' + l.qty; }).join('<br>')]]) + '</div>';
      var bar;
      if (KS.config.backend === 'gas') {
        body += '<p class="help">お支払いの画面（Square）が開きます。カードの番号は、このお店には届きません。</p>';
        bar = '<div class="s">' + yen(o.total) + '</div><a class="btn pri" href="' + esc(o.payUrl) + '">お支払いの画面へ</a>';
      } else {
        body += '<p class="help">カードでお支払いください。' + (o.payDeadline ? 'お支払いがないまま時間が過ぎると、' + (o.method === '配送' ? 'ご注文' : '取り置き') + 'は取り消しになります。' : '') + '</p>' +
          '<button class="btn block" data-act="cPay" data-token="' + esc(token) + '" data-paid="0">支払いをやめる</button>';
        bar = '<div class="s">' + yen(o.total) + '</div><button class="btn pri" data-act="cPay" data-token="' + esc(token) + '" data-paid="1">支払う</button>';
      }
      return page({ back: '#/c', up: 1, title: 'お支払い', steps: steps(ORDER_STEPS, 3), body: body, bar: bar });
    });
  }

  /* ================= C17 受付完了（取り置き・採寸・サロン C34 も同じ形） ================= */
  function doneHead(text, id) {
    return '<div class="c-done">' + ico('check', 'xl') + '<h1 class="mincho">' + esc(text) + '</h1><div class="no"><small>受付番号</small>' + esc(id) + '</div></div>';
  }
  function sentNote() { return '<p class="help">' + (B && B.inLine ? '受付の確認を、LINEのトークにお送りしました。' : '受付の確認を、ご入力のメールアドレスにお送りしました。届かないときも、この受付番号でご予約は確定しています。') + '</p>'; }
  function mapBox() {
    var s = shop();
    return sec('お店の場所', '<p class="c-addr">' + esc(s.address) + '<br><span class="t2">' + esc(s.hours) + '（' + esc(s.closedText) + '）</span></p>' +
      '<a class="btn block" href="' + esc(s.map) + '" target="_blank" rel="noopener">' + ico('pin') + '地図を開く</a>');
  }
  function myLink(kind, token, label) {
    return B && B.inLine ? '<a class="btn block" href="#/c/my">' + ico('list') + 'わたしの予約へ</a>'
      : '<a class="btn block" href="#/c/my/' + kind + '/' + seg(token) + '">' + ico('list') + esc(label || 'この予約を確かめる・取り消す') + '</a>';
  }
  function c17(r, p, b) {
    var kind = r[0], token = r[1];
    if (kind === 'order') {
      return call('orderDone', { token: token }).then(function (res) {
        if (!res.ok) return bad(res);
        var o = res.order;
        if (o.payStatus === '支払い待ち') {
          return page({
            back: '#/c', up: 1, title: 'お支払い', body: '<div class="notice warn">お支払いがまだ確かめられていません。お支払いが済むと受付になります。</div>' +
              kv([['受付番号', esc(o.id)], ['合計', yen(o.total)]]) + '<a class="btn pri block" href="' + esc(o.payUrl) + '">お支払いへ進む</a>' + telBtn()
          });
        }
        if (o.status === '取り消し') return c90('gone');
        nextReceive = o.id;
        if (o.type === '予約') {
          var body1 = doneHead('ご予約を受け付けました', o.id) +
            kv([['品物', o.lines.map(function (l) { return esc(l.label) + ' ×' + l.qty; }).join('<br>')], ['合計', yen(o.total) + '（お渡しのときに店頭で）'], ['お渡し', esc(o.handText)]]) + sentNote() +
            '<p class="help">入荷して用意ができたら、' + (B && B.inLine ? 'LINE' : 'お電話かメール') + 'でお知らせします。</p>' + mapBox() +
            myLink('order', o.token) + '<a class="btn block" href="#/c">はじめの画面へ</a>';
          return page({ back: '#/c', up: 1, title: '予約完了', body: body1 });
        }
        var rows = [
          ['品物', o.lines.map(function (l) { return esc(l.label) + ' ×' + l.qty; }).join('<br>')],
          ['受け取り', o.method === '配送' ? '配送：' + esc(o.ship ? o.ship.method : '') : 'お店で ' + esc(u.jpDate(o.pickupDate))],
          o.method === '配送' ? null : ['取り置きの期限', esc(u.jpDate(o.keepUntil)) + ' まで'],
          ['お支払い', o.pay === '事前' ? 'お支払い済み　' + yen(o.total) : '受け取りのときに店頭で　' + yen(o.total)]
        ];
        var body = doneHead(o.pay === '事前' ? 'お支払いを確かめ、受け付けました' : '取り置きを受け付けました', o.id) + kv(rows) + sentNote() +
          (o.method === '配送' ? '<p class="help">発送したら、あらためてお知らせします。</p>' : '<p class="help">受け取りの前日に、お知らせをお送りします。</p>' + mapBox()) +
          myLink('order', o.token) + '<a class="btn block" href="#/c">はじめの画面へ</a>';
        return page({ back: '#/c', up: 1, title: '受付完了', steps: steps(ORDER_STEPS, 4), body: body });
      });
    }
    if (kind !== 'salon' && kind !== 'measure') return c90('notfound');
    return call('detail', { kind: kind, token: token }).then(function (res) {
      if (!res.ok) return bad(res);
      var v = res.item;
      if (v.status !== '予約') return c90('gone');
      nextReceive = v.id;
      var body;
      if (kind === 'salon') {
        body = doneHead('ご予約を受け付けました', v.id) +
          kv([['日時', esc(when(v.date, v.start, v.end))], ['メニュー', esc(v.menuName)], ['料金', yen(v.price) + '（ご来店のときに店頭で）']]) + sentNote() +
          '<p class="help">キャンセル・日時の変更は、3時間前まで' + (B && B.inLine ? '「わたしの予約」' : '下の「この予約を確かめる・変える」') + 'からできます。それより後はお電話でご連絡ください。</p>' +
          '<a class="btn block" href="' + esc(gcal('水素サロン（ココスポーツ）', v.date, v.start, v.end)) + '" target="_blank" rel="noopener">' + ico('cal') + 'カレンダーに入れる</a>' +
          mapBox() + myLink('salon', v.token, 'この予約を確かめる・変える') + '<a class="btn block" href="#/c">はじめの画面へ</a>';
        return page({ back: '#/c', up: 1, title: '予約完了', steps: steps(SALON_STEPS, 4), body: body });
      }
      var vfit = v.type === '試着';
      body = doneHead(vfit ? '試着のご来店のご予約を受け付けました' : '採寸のご予約を受け付けました', v.id) +
        kv([['学校', esc(v.school)], ['日時', esc(when(v.date, v.start, v.end))], ['人数', v.count + '人'], ['お子さま', esc(v.children)]]) + sentNote() +
        (vfit ? '<p class="help">試着のあと、そのままお店でご予約いただけます。' + esc((b.reserve && b.reserve.handText) || '') + '</p>' : '') +
        '<a class="btn block" href="' + esc(gcal(vfit ? '体操服の試着（ココスポーツ）' : '制服の採寸（ココスポーツ）', v.date, v.start, v.end)) + '" target="_blank" rel="noopener">' + ico('cal') + 'カレンダーに入れる</a>' +
        mapBox() + myLink('measure', v.token) + '<a class="btn block" href="#/c">はじめの画面へ</a>';
      return page({ back: '#/c', up: 1, title: '予約完了', body: body });
    });
  }

  /* ================= C18 予約：品物の確認・連絡先・お約束（1つの画面） ================= */
  function checkRsv(f, inLine) {
    var e = {};
    if (!String(f.children || '').trim()) e.children = 'お子さまのお名前を入力してください。';
    if (!String(f.name || '').trim()) e.name = '保護者のお名前を入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!inLine && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。確認のお知らせをお送りします。';
    if (!f.agree) e.agree = 'お渡しの時期と先着順を確かめて、チェックを入れてください。';
    return e;
  }
  function c18(r, p, b) {
    var rv = rsv(), sid = rv.schoolId, more = '#/c/school' + (sid ? '/' + seg(sid) : '');
    if (!rsvOpen(b, sid) || !rv.lines.length) {
      return page({ back: more, title: 'ご予約', body: '<div class="c-empty">' + ico('bag', 'xl') + '<p>予約に入れた品はありません</p></div><a class="btn pri block" href="' + more + '">品物を選ぶ</a>' });
    }
    var f = dr('rsvf'), e = errs.rsvf || {};
    if (!f._filled && b.profile) { ['name', 'kana', 'phone', 'email'].forEach(function (k) { if (!f[k] && b.profile[k]) f[k] = b.profile[k]; }); }
    f._filled = 1; saveDraft();
    nextFormKey = 'rsvf';
    var lines = rv.lines.map(function (l, i) {
      return '<div class="c-line"><div class="n">' + esc(l.label) + '<small>' + yen(l.price) + ' × ' + l.qty + '点</small></div>' +
        '<div class="r"><b>' + yen(l.price * l.qty) + '</b>' + qtyBox('cRsvQty', 'data-i="' + i + '"', l.qty) +
        '<button type="button" class="linkbtn" data-act="cRsvQty" data-i="' + i + '" data-d="-99">外す</button></div></div>';
    }).join('');
    var body = '<div class="c-lines">' + lines + '</div>' + kv([['合計', '<b>' + yen(rsvTotal()) + '</b>（税込み・' + rsvCount() + '点）'], ['お支払い', 'お渡しのときに店頭で']]) +
      '<a class="btn block" href="' + more + '">' + ico('plus') + '続けて選ぶ</a>' +
      sec('ご予約のお約束', '<ul class="c-points"><li>' + esc(b.reserve.handText) + '</li><li>ご予約の早い順（先着順）にご用意します。入荷の数によっては、お待たせすることがあります。</li><li>サイズに迷うときは、お店で試着してから変えられます。</li><li>取り消しは「わたしの予約」' + (b.inLine ? '' : '（確認のメールのリンク）') + 'からできます。</li></ul>') +
      sec('連絡先',
        ui.field('children', 'お子さまのお名前', { req: 1, value: f.children, err: e.children, ph: '山田 そうた', help: 'ご兄弟は「、」で区切ってください。' }) +
        ui.field('name', '保護者のお名前', { req: 1, value: f.name, err: e.name, ac: 'name', ph: '山田 花子' }) +
        ui.field('kana', 'フリガナ', { req: false, value: f.kana, ac: 'off', ph: 'ヤマダ ハナコ' }) +
        ui.field('phone', '電話番号', { req: 1, value: f.phone, err: e.phone, type: 'tel', mode: 'tel', ac: 'tel', ph: '090-1234-5678', help: '入荷のことで、お店から連絡することがあります。' }) +
        (b.inLine ? '<p class="help">受付の確認と、入荷のお知らせは、LINEでお送りします。</p>'
          : ui.field('email', 'メールアドレス', { req: 1, value: f.email, err: e.email, type: 'email', mode: 'email', ac: 'email', ph: 'hanako@example.jp', help: '受付の確認と、ご予約の確認・取り消しのリンクをお送りします。' })) +
        ui.field('note', 'お店への連絡', { req: false, textarea: 1, value: f.note, ph: '例：名前の刺しゅうを入れたい' })) +
      ui.check('agree', 'お渡しは2月から（入荷のあと）・先着順でのご用意を確かめました。<a class="c-link" href="#/c/rules">プライバシーポリシー</a>', { value: f.agree, err: e.agree });
    return page({ back: more, title: 'ご予約の確認', body: body, bar: '<div class="s">合計<br>' + yen(rsvTotal()) + '</div><button class="btn pri" data-act="cRsvPlace">この内容で予約する</button>' });
  }

  /* ================= C20 入荷のお知らせの登録 ================= */
  function c20(r, p, b) {
    if (!b.stages.order) return soonPage('#/c', '入荷のお知らせ');
    var pid = r[0], size = r[1], key = pid + '|' + size;
    return call('item', { productId: pid, cartId: cartId() }).then(function (res) {
      if (!res.ok) return bad(res);
      var pr = res.product, sc = res.school, z = res.sizes.filter(function (x) { return x.size === size; })[0];
      if (!z) return c90('notfound');
      var label = (sc ? sc.short + ' ' : '') + pr.name + '（' + z.label + '）';
      var back = '#/c/item/' + seg(pid);
      var done = (D.waitDone || {})[key];
      if (done || z.waiting) {
        var ch = done ? done.channel : 'LINE';
        return page({
          back: back, title: '入荷のお知らせ', body: '<div class="c-done">' + ico('bell', 'xl') + '<h1 class="mincho">' + (done && !done.already ? '登録しました' : 'すでに登録されています') + '</h1></div>' +
            kv([['品物', esc(label)]]) + '<p class="help">入荷したら、' + (ch === 'LINE' ? 'LINE' : 'メール') + 'でお知らせします。お知らせから24時間は、優先して取り置きできます。</p>' +
            '<a class="btn block" href="' + back + '">ほかのサイズを見る</a>' + (sc ? '<a class="btn block" href="#/c/school/' + seg(sc.id) + '">ほかの品物を見る</a>' : '') +
            (B.inLine ? '<a class="btn block" href="#/c/my">わたしの予約へ</a>' : '')
        });
      }
      nextFormKey = 'wait';
      var w = dr('wait'), e = errs.wait || {};
      var body = '<p class="c-lead">このサイズが入荷したら、お知らせします。</p>' + kv([['品物', esc(label)], ['価格', z.price ? yen(z.price) : '—']]) +
        (z.state !== '品切れ' ? '<div class="notice ok">このサイズは、いま在庫があります。<a class="c-link" href="' + back + '?size=' + seg(size) + '">取り置きへ進む</a></div>' : '') +
        '<ul class="c-points"><li>お知らせは、登録の早い順に、入荷した数の分だけお送りします。</li><li>お知らせから24時間は、優先して取り置きできます。過ぎると次の方にお知らせします。</li></ul>' +
        (B.inLine ? '<p class="help">LINEでお知らせします。入力はいりません。</p>'
          : ui.field('email', 'お知らせを受け取るメールアドレス', { req: 1, value: w.email, err: e.email, type: 'email', mode: 'email', ac: 'email', ph: 'hanako@example.jp' }));
      return page({ back: back, title: '入荷のお知らせ', body: body, bar: '<div class="s">' + esc(z.label) + '</div><button class="btn pri" data-act="cWait" data-pid="' + esc(pid) + '" data-size="' + esc(size) + '">' + ico('bell') + '登録する</button>' });
    });
  }

  /* ================= C21 入荷のお知らせから開く ================= */
  function c21(r, p, b) {
    if (!b.stages.order) return soonPage('#/c', '入荷のお知らせ');
    var token = r[0];
    return call('restockOpen', { token: token, cartId: cartId() }).then(function (res) {
      if (!res.ok) return bad(res);
      var w = res.wait, pr = res.product, itemUrl = '#/c/item/' + seg(w.productId);
      var head0 = '<div class="c-prod"><div class="sc">入荷のお知らせ</div><h1>' + esc(w.label) + '</h1><div class="pr">' + (res.price ? yen(res.price) + '<small>（税込み）</small>' : '') + '</div></div>';
      if (w.status === '予約済み') {
        return page({ back: '#/c', title: '入荷のお知らせ', body: head0 + '<div class="notice ok">この品は、取り置きのご予約が済んでいます。</div>' + (B.inLine ? '<a class="btn block" href="#/c/my">わたしの予約へ</a>' : '') });
      }
      if (!res.mine) {
        return page({ back: '#/c', title: '入荷のお知らせ', body: head0 + '<div class="notice">このお知らせは、別の方あてのものです。在庫は品物の画面で見られます。</div><a class="btn pri block" href="' + itemUrl + '">品物の画面へ</a>' });
      }
      if (!res.inTime) {
        var has = res.state !== '品切れ';
        return page({
          back: '#/c', title: '入荷のお知らせ', body: head0 + '<div class="notice warn">優先して取り置きできる時間（24時間）が過ぎました。</div>' +
            (has ? '<p class="c-lead">いまは在庫があります。ふつうの取り置きで選べます。</p><a class="btn pri block" href="' + itemUrl + '?size=' + seg(res.size) + '">サイズ ' + esc(res.sizeLabel || res.size) + ' を見る</a>'
              : '<p class="c-lead">いまは品切れです。もう一度、入荷のお知らせに登録できます。</p><a class="btn pri block" href="#/c/wait/' + seg(w.productId) + '/' + seg(res.size) + '">' + ico('bell') + 'もう一度登録する</a>')
        });
      }
      var q = (dr('sel')['r:' + token] || {}).qty || 1;
      var untilLocal = Date.now() + res.msLeft;
      var body = head0 + '<div class="c-timer">' + ico('clock') + '<span>あと <b data-until="' + untilLocal + '" data-reload="1">' + left(res.msLeft) + '</b> 優先して取り置きできます。</span></div>' +
        sec('サイズ', '<div class="sizes c-sizes"><button type="button" class="sel">' + esc(res.sizeLabel || res.size) + '<small>入荷</small></button></div>' +
          '<div class="c-qtyrow"><span>数</span>' + qtyBox('cSelQty', 'data-pid="r:' + esc(token) + '"', q) + '</div>' +
          '<p class="help">2点以上は、ほかの方と同じ在庫から選びます。ご用意できないときはお知らせします。</p>');
      return page({
        back: '#/c', title: '入荷のお知らせ', body: body,
        bar: '<div class="s">' + esc(res.sizeLabel || res.size) + '・' + q + '点<br>' + (res.price ? yen(res.price * q) : '') + '</div><button class="btn pri" data-act="cAdd" data-pid="' + esc(w.productId) + '" data-size="' + esc(res.size) + '" data-key="r:' + esc(token) + '">' + ico('bag') + 'かごに入れる</button>'
      });
    });
  }

  /* ================= C25 採寸：学校と日程の枠 ================= */
  function c25(r, p, b) {
    var sid = r[0], fit = !!sid && rsvOpen(b, sid);
    if (!b.stages.measure && !fit) return soonPage('#/c', '採寸の予約');
    if (!sid) {
      return fast('measureSchools').then(function (res) {
        if (!res.ok) return bad(res);
        if (!res.open) return closedPage('#/c', '採寸の予約', '採寸のご予約は準備中です。お電話でお問い合わせください。');
        var body = '<p class="c-lead">中学校の制服は、採寸してからご用意します。学校を選ぶと、採寸の日程が見られます。</p><div class="schools">' +
          res.schools.map(function (s) { return '<a href="#/c/measure/' + seg(s.id) + '">' + esc(s.name) + '<span>' + (s.slots ? '日程 ' + s.slots + '件' : '日程は準備中') + ico('next') + '</span></a>'; }).join('') + '</div>';
        return page({ back: '#/c', title: '採寸の予約', body: body });
      });
    }
    return fast('measureSlots', { schoolId: sid }).then(function (res) {
      if (!res.ok) return bad(res);
      var days = {}, order = [];
      res.slots.forEach(function (s) { if (!days[s.date]) { days[s.date] = []; order.push(s.date); } days[s.date].push(s); });
      var ttl = res.fit ? '試着のご来店予約' : '採寸の予約', bk = res.fit ? '#/c/school/' + seg(res.school.id) : '#/c/measure';
      var body = '<div class="c-pagehd"><h1>' + esc(res.school.name) + '</h1>' + (res.fit ? '' : '<a class="c-link" href="#/c/measure">学校を変える</a>') + '</div>';
      if (!res.slots.length || res.slots.every(function (s) { return s.left <= 0; })) {
        body += '<div class="notice">' + (res.slots.length ? 'いまご予約できる日程は、すべて埋まっています。' : 'いまご予約できる日程はありません。') + '日程が増えたらお知らせします。お急ぎの方はお電話でご相談ください。</div>' + telBtn();
        return page({ back: bk, title: ttl, body: body });
      }
      /* 日を選んでから、その日の時間を出す（選んだ日はこの端末に覚えておく） */
      var freeDay = function (d) { return days[d].some(function (s) { return s.left > 0; }); };
      var sel = dr('mday')[res.school.id];
      if (!sel || !days[sel]) sel = order.filter(freeDay)[0] || order[0];
      body += (res.fit ? '<p class="c-lead">お店で体操服を試着して、サイズを決められます。試着の時間は30分です。日にちを選んでから、時間を選んでください。</p>' +
          '<ul class="c-points"><li>試着のあと、そのままお店でご予約いただけます。</li><li>' + esc(res.handText) + '</li><li>ご兄弟は、人数をまとめて1つの枠でご予約できます。</li></ul>'
        : '<p class="c-lead">日にちを選んでから、ご都合の良い時間を選んでください。ご兄弟は、人数をまとめて1つの枠でご予約できます。</p>') +
        mdayGrid(res.school.id, order, days) + sec(u.jpDate(sel), '<div class="c-mslots">' + days[sel].map(function (s) {
          var full = s.left <= 0;
          return '<button type="button" ' + (full ? 'disabled' : 'data-act="cMeasurePick" data-id="' + esc(s.id) + '" data-date="' + s.date + '" data-start="' + s.start + '" data-end="' + s.end + '" data-school="' + esc(res.school.id) + '" data-name="' + esc(res.school.name) + '"') + '>' +
            u.hm(s.start) + '〜' + u.hm(s.end) + '<small>' + (full ? '満' : s.mark === '△' ? '残りわずか' : '空きあり') + '</small></button>';
        }).join('') + '</div>') + '<p class="legend">満：その時間は埋まっています。休：お店の休みの日です</p>';
      return page({ back: bk, title: ttl, body: body });
    });
  }

  /* 採寸・試着の日にちの表（曜日をそろえた7列）。空きのある日だけ押せる */
  function mdayGrid(sid, order, days) {
    var sel = dr('mday')[sid], first = order[0], last = order[order.length - 1], has = {};
    order.forEach(function (d) { has[d] = days[d].some(function (s) { return s.left > 0; }) ? 1 : 2; });
    if (!sel || !has[sel] || has[sel] === 2) sel = order.filter(function (d) { return has[d] === 1; })[0] || first;
    var cells = ['日', '月', '火', '水', '木', '金', '土'].map(function (w, i) { return '<span class="wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') + '">' + w + '</span>'; }).join('');
    for (var i = 0; i < u.wd(first); i++) cells += '<span></span>';
    for (var d = first; d <= last; d = u.addDays(d, 1)) {
      var dt = u.parse(d), lab = (dt.getMonth() + 1) + '/' + dt.getDate();
      cells += has[d] === 1 ? '<button type="button" class="' + (sel === d ? 'sel' : '') + '" data-act="cSet" data-s="mday" data-k="' + esc(sid) + '" data-v="' + d + '" aria-label="' + esc(u.jpDate(d)) + '">' + lab + '</button>'
        : '<span class="off">' + lab + '<small>' + (has[d] === 2 ? '満' : '休') + '</small></span>';
    }
    return sec('日にち', '<div class="c-days">' + cells + '</div>');
  }

  /* ================= C26 採寸：人数・お子さまの名前・連絡先・確認 ================= */
  function checkMeasure(f, inLine) {
    var e = {};
    if (!(+f.count >= 1 && +f.count <= 5)) e.count = '人数を選んでください。';
    if (!String(f.children || '').trim()) e.children = 'お子さまのお名前を入力してください。';
    if (!String(f.name || '').trim()) e.name = '保護者のお名前を入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!inLine && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。';
    return e;
  }
  function c26(r, p, b) {
    var m = dr('measure'), fit = /^F/.test(String(m.slotId || '')) && rsvOpen(b, m.schoolId), ttl = fit ? '試着のご来店予約' : '採寸の予約';
    if (!b.stages.measure && !fit) return soonPage('#/c', '採寸の予約');
    if (m.slotId !== r[0]) { KS.app.replace('#/c/measure'); return ui.loading(); }
    if (!m._filled && b.profile) { m.name = m.name || b.profile.name; m.phone = m.phone || b.profile.phone; }
    m._filled = 1; if (!m.count) m.count = '1'; saveDraft();
    nextFormKey = 'measure';
    var e = errs.measure || {}, back = '#/c/measure/' + seg(m.schoolId);
    var slot = kv([['学校', esc(m.schoolName)], ['日時', esc(when(m.date, m.start, m.end))]]);
    if (p.check === '1') {
      if (Object.keys(checkMeasure(m, b.inLine)).length) { KS.app.replace('#/c/measure-form/' + seg(m.slotId)); return ui.loading(); }
      var body = slot + kv([['人数', esc(m.count) + '人'], ['お子さま', esc(m.children)], ['保護者', esc(m.name)], ['電話番号', esc(m.phone)],
        b.inLine ? ['確認の連絡', 'LINEでお送りします'] : ['メール', esc(m.email)], m.note ? ['ご要望', ui.br(m.note)] : null]) +
        '<p class="help">取り消しは「わたしの予約」（メールの方は確認のメールのリンク）からできます。</p>' +
        ui.check('agree', '<a class="c-link" href="#/c/rules">プライバシーポリシー</a>を確かめました', { value: m.agree, err: e.agree });
      return page({ back: '#/c/measure-form/' + seg(m.slotId), title: '内容の確認', body: body, bar: '<div class="s">' + esc(u.jpDate(m.date)) + '<br>' + u.hm(m.start) + '〜</div><button class="btn pri" data-act="cMeasureBook">この内容で予約する</button>' });
    }
    var body2 = slot +
      ui.field('count', '人数', { req: 1, select: [1, 2, 3, 4, 5].map(function (n) { return { value: String(n), label: n + '人' }; }), value: m.count, noBlank: 1, err: e.count, help: 'ご兄弟は人数をまとめて1つの枠でご予約できます。' }) +
      ui.field('children', 'お子さまのお名前', { req: 1, value: m.children, err: e.children, ph: '山田 そうた、山田 ゆい', help: '2人以上のときは「、」で区切ってください。' }) +
      ui.field('name', '保護者のお名前', { req: 1, value: m.name, err: e.name, ac: 'name', ph: '山田 花子' }) +
      ui.field('phone', '電話番号', { req: 1, value: m.phone, err: e.phone, type: 'tel', mode: 'tel', ac: 'tel', ph: '090-1234-5678' }) +
      (b.inLine ? '<p class="help">確認の連絡は、LINEでお送りします。</p>' : ui.field('email', 'メールアドレス', { req: 1, value: m.email, err: e.email, type: 'email', mode: 'email', ac: 'email', ph: 'hanako@example.jp', help: '確認と、取り消しのリンクをお送りします。' })) +
      ui.field('note', 'ご要望', { req: false, textarea: 1, value: m.note, ph: fit ? '例：長そでと半ズボンを試したい' : '例：体操服も一緒に見たい' });
    return page({ back: back, title: ttl, body: body2, bar: '<div class="s">' + esc(u.jpDate(m.date)) + '<br>' + u.hm(m.start) + '〜</div><button class="btn pri" data-act="cMeasureNext">確認へ' + ico('next') + '</button>' });
  }

  /* ================= C30 水素サロン：メニューと料金 ================= */
  function c30(r, p, b) {
    if (!b.stages.salon) return salonClosed(b.shop.airReserve);
    return call('salonMenus').then(function (res) {
      if (!res.ok) return bad(res);
      if (res.closed) return salonClosed(res.airReserve);
      var s = dr('salon');
      var list = res.menus.map(function (m) {
        var no = m.firstOnly && res.firstTime === false;
        return '<button type="button" class="menu' + (s.menuId === m.id ? ' sel' : '') + '"' + (no ? ' disabled' : ' data-act="cMenu" data-id="' + esc(m.id) + '"') + '>' +
          '<div><div class="n">' + esc(m.name) + (m.firstOnly ? '<span class="first">初めての方</span>' : '') + '</div><div class="m">' + esc(m.desc) +
          (no ? '<br>2回目以降の方は、30分・60分コースをお選びください。' : '') + '</div></div><div class="p">' + yen(m.price) + '</div></button>';
      }).join('');
      var body = '<section class="c-intro sky"><div class="en">HYDROGEN SALON</div><h1 class="mincho">完全個室・2席の水素サロン</h1>' +
        '<p>お買い物のついでに、静かな個室でひと休み。おひとりでも、お二人同時でもご利用いただけます。</p></section>' +
        '<div class="c-menus">' + list + '</div>' +
        '<ul class="c-points"><li>料金は税込み。お支払いはご来店のときに店頭で。</li><li>ご予約は' + res.rules.horizonDays + '日先まで、' + (res.rules.deadlineMin / 60) + '時間前まで受け付けます。</li>' +
        '<li>キャンセル・日時の変更は' + (res.rules.cancelMin / 60) + '時間前まで。それより後はお電話で。</li></ul>';
      return page({ back: '#/c', title: '水素サロン', steps: steps(SALON_STEPS, 1), body: body });
    });
  }
  /* このしくみのサロン予約を出す前は、これまでの予約の画面（Airリザーブ）で受け付ける（2026-11-01 本人） */
  function salonClosed(url) {
    return page({
      back: '#/c', title: '水素サロン', body: '<section class="c-intro sky"><div class="en">HYDROGEN SALON</div><h1 class="mincho">完全個室・2席の水素サロン</h1>' +
        '<p>お買い物のついでに、静かな個室でひと休み。おひとりでも、お二人同時でもご利用いただけます。</p></section>' +
        (url ? '<p class="c-lead">空いている時間を見て、ご予約の画面からお選びください。</p><a class="btn pri block" href="' + esc(url) + '" target="_blank" rel="noopener">' + ico('cal') + '空いている時間を見て予約する</a>'
          : '<div class="notice">ご予約はお電話で承ります。</div>') + telBtn()
    });
  }

  /* ================= C31 水素サロン：日時（週の表） ================= */
  function moveOf(p) { return p.move && D.move && D.move.token === p.move ? D.move : null; }
  function c31(r, p, b) {
    if (!b.stages.salon) return salonClosed(b.shop.airReserve);
    var menuId = r[0], s = dr('salon'), mv = moveOf(p);
    if (s.menuId !== menuId) { s.menuId = menuId; s.date = ''; s.start = null; s.from = ''; saveDraft(); }
    var from = s.from && s.from >= b.today ? s.from : b.today;
    return call('salonWeek', { menuId: menuId, from: from, ignoreId: mv ? mv.id : '' }).then(function (res) {
      if (!res.ok) return res.code === 'menu' ? (KS.app.replace('#/c/salon'), ui.loading()) : bad(res);
      var m = res.menu, days = res.days, times = days[0].slots.map(function (x) { return x.start; }), cnt = 0;
      var grid = '<div class="slots c-week" style="grid-template-columns:42px repeat(7,1fr)"><div class="h"></div>' +
        days.map(function (d) { var w = u.wd(d.date), dt = u.parse(d.date); return '<div class="h' + (w === 6 ? ' sat' : w === 0 ? ' sun' : '') + '">' + u.WD[w] + '<br>' + (dt.getMonth() + 1) + '/' + dt.getDate() + '</div>'; }).join('');
      times.forEach(function (t, ti) {
        grid += '<div class="h tm">' + u.hm(t) + '</div>';
        days.forEach(function (d) {
          var x = d.slots[ti];
          if (x.mark === '休') { grid += '<div class="slot off">' + (ti === 0 ? '休' : '') + '</div>'; return; }
          if (!x.ok) { grid += '<div class="slot x" title="' + esc(x.why) + '">×</div>'; return; }
          cnt++;
          var sel = s.date === d.date && +s.start === t;
          grid += '<button type="button" class="slot' + (sel ? ' sel' : '') + '" data-act="cSlot" data-date="' + d.date + '" data-start="' + t + '" aria-label="' + esc(u.jpDate(d.date) + ' ' + u.hm(t) + ' ' + x.why) + '">' + x.mark + '</button>';
        });
      });
      grid += '</div>';
      var prevOk = from > res.today, nextOk = u.addDays(from, 7) <= res.horizon;
      var body = (mv ? '<div class="notice">ご予約の日時を変えます。新しい時間を選んでください。</div>' : '') +
        '<div class="c-pagehd"><h1>' + esc(m.name) + '</h1>' + (mv ? '' : '<a class="c-link" href="#/c/salon">メニューを変える</a>') + '</div>' +
        '<div class="wk"><button type="button" data-act="cWeek" data-d="-7"' + (prevOk ? '' : ' disabled') + '>' + ico('back') + '前の週</button><span>' + esc(u.shortDate(days[0].date)) + '〜' + esc(u.shortDate(days[6].date)) + '</span>' +
        '<button type="button" data-act="cWeek" data-d="7"' + (nextOk ? '' : ' disabled') + '>次の週' + ico('next') + '</button></div>' +
        (cnt ? '' : '<div class="notice">この週は空いている時間がありません。' + (nextOk ? '次の週をご覧いただくか、' : '') + 'お電話でご相談ください。</div>') +
        '<div class="c-weekwrap">' + grid + '</div>' +
        '<p class="legend">○ 空きあり　△ 残り1席　× 満席・受付の時間外　休 定休日<br>ご予約は2時間前まで。' + (m.seats === 2 ? '2名同時は、2席とも空いている時間だけ選べます。' : '') + '</p>' +
        (cnt ? '' : telBtn());
      var picked = !!s.date && s.start != null;
      var bar = picked ? '<div class="s">' + esc(when(s.date, +s.start, +s.start + m.mins)) + '</div>' +
        (mv ? '<button class="btn pri" data-act="cMove">この日時に変える</button>' : '<a class="btn pri" href="#/c/salon-form">次へ' + ico('next') + '</a>')
        : '<div class="s">時間を選んでください</div><button class="btn pri" disabled>次へ</button>';
      return page({ back: mv ? '#/c/my/salon/' + seg(mv.token) : '#/c/salon', title: mv ? '日時を変える' : '日時を選ぶ', steps: mv ? '' : steps(SALON_STEPS, 2), body: body, bar: bar });
    });
  }

  /* ================= C32 水素サロン：連絡先 ================= */
  function checkSalon(f, inLine) {
    var e = {};
    if (!String(f.name || '').trim()) e.name = 'お名前を入力してください。';
    if (!u.normKana(f.kana)) e.kana = 'フリガナを入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!inLine && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。確認のお知らせをお送りします。';
    return e;
  }
  function c32(r, p, b) {
    if (!b.stages.salon) return salonClosed(b.shop.airReserve);
    var s = dr('salon');
    if (!s.menuId || !s.date || s.start == null) { KS.app.replace('#/c/salon' + (s.menuId ? '/' + seg(s.menuId) : '')); return ui.loading(); }
    return call('salonForm').then(function (res) {
      if (!res.ok) return bad(res);
      var f = dr('sf'), pr = res.profile;
      if (!f._filled && pr.inLine) ['name', 'kana', 'phone', 'email'].forEach(function (k) { if (!f[k] && pr[k]) f[k] = pr[k]; });
      f._filled = 1; f.askHeard = pr.askHeard; saveDraft();
      nextFormKey = 'sf';
      var e = errs.sf || {};
      var body = '<div class="c-mini">' + esc(when(s.date, +s.start)) + '〜</div>' +
        ui.field('name', 'お名前', { req: 1, value: f.name, err: e.name, ac: 'name', ph: '山田 花子' }) +
        ui.field('kana', 'フリガナ', { req: 1, value: f.kana, err: e.kana, ph: 'ヤマダ ハナコ' }) +
        ui.field('phone', '電話番号', { req: 1, value: f.phone, err: e.phone, type: 'tel', mode: 'tel', ac: 'tel', ph: '090-1234-5678' }) +
        (pr.inLine ? '<p class="help">確認と前日のお知らせは、LINEでお送りします。</p>'
          : ui.field('email', 'メールアドレス', { req: 1, value: f.email, err: e.email, type: 'email', mode: 'email', ac: 'email', ph: 'hanako@example.jp', help: '確認と前日のお知らせ、キャンセル・変更のリンクをお送りします。' })) +
        (pr.askHeard ? ui.field('heardFrom', 'お店をどこで知りましたか', { req: false, select: res.heard, value: f.heardFrom }) : '') +
        ui.field('note', 'ご要望', { req: false, textarea: 1, value: f.note, ph: '例：初めてなので、使い方を知りたい' }) +
        '<p class="help">体調や持病のことはお聞きしません。気になることがあれば、ご来店のときにスタッフへどうぞ。</p>';
      return page({ back: '#/c/salon/' + seg(s.menuId), title: '連絡先', steps: steps(SALON_STEPS, 3), body: body, bar: '<div class="s">入力した内容は、次の画面で確かめられます</div><button class="btn pri" data-act="cSalonNext">確認へ' + ico('next') + '</button>' });
    });
  }

  /* ================= C33 水素サロン：確認 ================= */
  function c33(r, p, b) {
    if (!b.stages.salon) return salonClosed(b.shop.airReserve);
    var s = dr('salon'), f = dr('sf');
    if (!s.menuId || !s.date || s.start == null) { KS.app.replace('#/c/salon'); return ui.loading(); }
    if (Object.keys(checkSalon(f, b.inLine)).length) { KS.app.replace('#/c/salon-form'); return ui.loading(); }
    return call('salonMenus').then(function (res) {
      if (!res.ok) return bad(res);
      var m = (res.menus || []).filter(function (x) { return x.id === s.menuId; })[0];
      if (!m) { KS.app.replace('#/c/salon'); return ui.loading(); }
      nextFormKey = 'sf';
      var e = errs.sconf || {};
      var body = kv([
        ['日時', '<b>' + esc(when(s.date, +s.start, +s.start + m.mins)) + '</b>'], ['メニュー', esc(m.name)], ['料金', yen(m.price) + '（税込み・ご来店のときに店頭で）'],
        ['お名前', esc(f.name) + '（' + esc(f.kana) + '）'], ['電話番号', esc(f.phone)], b.inLine ? ['確認の連絡', 'LINEでお送りします'] : ['メール', esc(f.email)],
        f.heardFrom ? ['知ったきっかけ', esc(f.heardFrom)] : null, f.note ? ['ご要望', ui.br(f.note)] : null
      ]) +
        '<div class="notice">キャンセル・日時の変更は、' + (res.rules.cancelMin / 60) + '時間前まで「わたしの予約」' + (b.inLine ? '' : '（確認のメールのリンク）') + 'からできます。それより後はお電話（' + esc(shop().tel) + '）でご連絡ください。</div>' +
        ui.check('agree', '<a class="c-link" href="#/c/rules">プライバシーポリシーとキャンセルの決まり</a>を確かめました', { value: f.agree, err: e.agree });
      return page({ back: '#/c/salon-form', title: '内容の確認', steps: steps(SALON_STEPS, 4), body: body, bar: '<div class="s">' + yen(m.price) + '<br>お支払いは店頭で</div><button class="btn pri" data-act="cSalonBook">この内容で予約する</button>' });
    });
  }

  /* ================= C40 わたしの予約 ================= */
  function c40(r, p, b) {
    if (!b.stages.order && !b.stages.salon && !b.stages.measure && !b.stages.reserve) return soonPage('#/c', 'わたしの予約');
    return call('myList').then(function (res) {
      if (!res.ok && res.code === 'line') {
        return page({
          back: '#/c', title: 'わたしの予約', body: '<div class="c-empty">' + ico('list', 'xl') + '<p>ご予約の確認・取り消しは、<br>確認のメールのリンクから開けます。</p></div>' +
            '<p class="help">公式LINEで友だちになってからご予約いただくと、ここでご予約をまとめて見られます。</p>' +
            '<a class="btn block" href="' + esc(shop().lineAddUrl) + '" target="_blank" rel="noopener">' + ico('line') + 'LINEで友だちになる</a>' + telBtn()
        });
      }
      if (!res.ok) return bad(res);
      var row = function (href, t, sub, st) { return '<a class="c-item" href="' + href + '"><span class="n">' + t + '<small>' + sub + '</small></span><span class="r"><span class="mk">' + esc(st) + '</span>' + ico('next') + '</span></a>'; };
      var secs = [];
      if (res.orders.length) secs.push(sec('体操服・制服のご予約と取り置き', '<div class="c-items">' + res.orders.map(function (o) {
        var n = o.lines.length;
        return row('#/c/my/order/' + seg(o.token), esc(o.lines[0] ? o.lines[0].label : '') + (n > 1 ? ' ほか' + (n - 1) + '品' : ''),
          esc(o.id) + '・' + (o.type === '予約' ? '予約（入荷のあとお渡し）' : o.method === '配送' ? '配送' : 'お店で ' + esc(u.shortDate(o.pickupDate))), o.status);
      }).join('') + '</div>'));
      if (res.measure.length) secs.push(sec('試着・採寸', '<div class="c-items">' + res.measure.map(function (m) {
        return row('#/c/my/measure/' + seg(m.token), esc(m.type === '試着' ? '試着 ' + m.school : m.school), esc(when(m.date, m.start)) + '・' + m.count + '人', m.status);
      }).join('') + '</div>'));
      if (res.salon.length) secs.push(sec('水素サロン', '<div class="c-items">' + res.salon.map(function (s) {
        return row('#/c/my/salon/' + seg(s.token), esc(s.menuName), esc(when(s.date, s.start, s.end)), s.status);
      }).join('') + '</div>'));
      if (res.waits.length) secs.push(sec('入荷のお知らせ', '<div class="c-items">' + res.waits.map(function (w) {
        return row('#/c/my/wait/' + seg(w.token), esc(w.label), '登録 ' + esc(String(w.createdAt).slice(5, 10).replace('-', '/')), w.status === 'お知らせ済み' ? '入荷しました' : '入荷待ち');
      }).join('') + '</div>'));
      var body = secs.length ? secs.join('') + '<p class="help">終わったご予約は、30日たつと表示されなくなります。</p>'
        : '<div class="c-empty">' + ico('list', 'xl') + '<p>いまのご予約はありません</p></div><a class="btn block" href="#/c/school">体操服・制服を見る</a><a class="btn block" href="#/c/salon">水素サロンを予約する</a>';
      return page({ back: '#/c', title: 'わたしの予約', body: body });
    });
  }

  /* ================= C41 予約の詳細 ================= */
  function c41(r, p, b) {
    var kind = r[0], token = r[1];
    return call('detail', { kind: kind, token: token }).then(function (res) {
      if (!res.ok) return bad(res);
      var v = res.item, back = res.inLine ? '#/c/my' : '#/c', body = '', acts = '';
      var cancelBtn = function (label) { return '<button class="btn block c-danger" data-act="cCancel" data-kind="' + kind + '" data-token="' + esc(token) + '" data-label="' + esc(label) + '">' + esc(label) + '</button>'; };
      if (kind === 'order') {
        body = kv([
          ['受付番号', esc(v.id)], ['状態', esc(v.status)],
          ['品物', v.lines.map(function (l) { return esc(l.label) + ' ×' + l.qty; }).join('<br>')],
          v.type === '予約' ? ['お渡し', esc(v.handText)] : ['受け取り', v.method === '配送' ? '配送：' + esc(v.ship ? v.ship.method : '') : 'お店で ' + esc(u.jpDate(v.pickupDate))],
          v.type !== '予約' && v.method !== '配送' && v.status !== '取り消し' && v.status !== '受け取り済み' ? ['取り置きの期限', esc(u.jpDate(v.keepUntil)) + ' まで'] : null,
          ['合計', yen(v.total) + '（' + (v.pay === '事前' ? (v.payStatus === '支払い済み' ? 'お支払い済み' : 'ネットで先にお支払い') : '店頭でお支払い') + '）'],
          v.cancelReason ? ['取り消しの理由', esc(v.cancelReason)] : null
        ]);
        if (v.payUrl) acts += '<a class="btn pri block" href="' + esc(v.payUrl) + '">お支払いへ進む</a>';
        if (v.mustCall) acts += '<div class="notice">お店で用意が済んでいます。取り消し・日の変更はお電話でお願いします。</div>' + telBtn(null, true);
        else if (v.canCancel) acts += cancelBtn(v.type === '予約' ? 'この予約を取り消す' : 'この取り置きを取り消す');
        if (v.status === '受付' && v.method !== '配送' && v.type !== '予約') acts += '<p class="help">受け取りの日を変えたいときは、お電話でご連絡ください。</p>';
      } else if (kind === 'salon') {
        body = kv([['予約番号', esc(v.id)], ['状態', esc(v.status)], ['日時', esc(when(v.date, v.start, v.end))], ['メニュー', esc(v.menuName)], ['料金', yen(v.price) + '（店頭で）']]);
        if (v.canChange) acts += '<button class="btn pri block" data-act="cMoveStart" data-token="' + esc(token) + '" data-id="' + esc(v.id) + '" data-menu="' + esc(v.menuId) + '">' + ico('cal') + '日時を変える</button>' + cancelBtn('この予約を取り消す') +
          '<p class="help">キャンセル・変更は3時間前までです。</p>';
        else if (v.mustCall) acts += '<div class="notice">3時間前を過ぎたため、ここでは変えられません。お電話でご連絡ください。</div>' + telBtn(null, true);
        if (v.status === '来店済み' && res.voice) acts += res.voice.canWrite ? '<a class="btn pri block" href="#/c/voice/' + seg(token) + '">' + ico('star') + 'ご感想を送る</a>' : '<p class="help">ご感想をお送りいただき、ありがとうございました。</p>';
        if (v.status === '予約') acts += '<a class="btn block" href="' + esc(gcal('水素サロン（ココスポーツ）', v.date, v.start, v.end)) + '" target="_blank" rel="noopener">' + ico('cal') + 'カレンダーに入れる</a>';
      } else if (kind === 'measure') {
        body = kv([['予約番号', esc(v.id)], ['種類', v.type === '試着' ? '試着のご来店' : '採寸'], ['状態', esc(v.status)], ['学校', esc(v.school)], ['日時', esc(when(v.date, v.start, v.end))], ['人数', v.count + '人'], ['お子さま', esc(v.children)]]);
        if (v.canCancel) acts += cancelBtn('この予約を取り消す') + '<p class="help">日時を変えたいときは、取り消してから選び直してください。</p>';
      } else if (kind === 'wait') {
        var active = v.status === '待ち' || v.status === 'お知らせ済み';
        body = kv([['品物', esc(v.label)], ['状態', esc(v.status === '待ち' ? '入荷待ち' : v.status === 'お知らせ済み' ? '入荷しました' : v.status)], ['登録', esc(v.createdAt)], ['お知らせの方法', esc(v.channel)]]);
        if (v.status === 'お知らせ済み') acts += '<a class="btn pri block" href="#/c/restock/' + seg(token) + '">' + ico('bag') + '取り置きへ進む</a>';
        if (active) acts += cancelBtn('入荷のお知らせをやめる');
      } else return c90('notfound');
      return page({ back: back, title: 'ご予約の内容', body: body + acts + (res.inLine ? '' : '<p class="help">このページは、確認のメールのリンクからいつでも開けます。</p>') });
    });
  }

  /* ================= C50 来店後の声 ================= */
  function c50(r, p, b) {
    var token = r[0] || '', key = token || 'qr';
    var up = token ? '#/c/my/salon/' + seg(token) : '#/c';   /* 戻るの親：予約から来たらその予約、店頭のQRからなら、はじめの画面 */
    if (!b.stages.voice) return soonPage(up, 'ご感想');
    var done = (D.voiceDone || {})[key];
    if (done) {
      return page({
        back: up, title: 'ご感想', body: '<div class="c-done">' + ico('check', 'xl') + '<h1 class="mincho">ありがとうございました</h1></div>' +
          (done.googleUrl ? '<p class="c-lead">よろしければ、Googleにもご感想をお寄せください。これからお店を探す方の参考になります。</p><a class="btn block" href="' + esc(done.googleUrl) + '" target="_blank" rel="noopener">Googleにご感想を書く</a>'
            : '<p class="c-lead">いただいた声は、お店の改善に使わせていただきます。</p>') + '<a class="btn block" href="#/c">はじめの画面へ</a>'
      });
    }
    nextFormKey = 'voice';
    var v = dr('voice'), n = +v.stars || 0, e = errs.voice || {}, stars = '';
    for (var i = 1; i <= 5; i++) stars += '<button type="button" class="' + (n >= i ? 'on' : '') + '" data-act="cStar" data-n="' + i + '" aria-label="星' + i + 'つ">' + ico('star') + '</button>';
    var body = '<div class="c-done"><h1 class="mincho">ご来店ありがとうございました</h1><p class="help">今日のご感想を、星でお聞かせください。</p></div>' +
      '<div class="stars c-stars">' + stars + '</div>' + (e.stars ? '<div class="errtxt c-center">' + esc(e.stars) + '</div>' : '') +
      ui.field('text', 'ひとこと', { req: false, textarea: 1, value: v.text, ph: '感じたことを、ご自由にどうぞ' }) +
      ui.field('toShop', 'お店に伝えたいこと', { req: false, textarea: 1, value: v.toShop, ph: '気になったことやご要望など（お店だけが読みます）' }) +
      '<p class="help">お名前は出しません。</p>';
    return page({ back: up, title: 'ご感想', body: body, bar: '<div class="s"></div><button class="btn pri" data-act="cVoice" data-token="' + esc(token) + '">送る</button>' });
  }

  /* ================= C60 決まりの表示 ================= */
  function c60(r, p, b) {
    var L = b.legal || {};
    var toko = String(L.tokushoho || '').split('\n').filter(Boolean).map(function (l) { var i = l.indexOf('：'); return i > 0 ? [l.slice(0, i), esc(l.slice(i + 1))] : ['', esc(l)]; });
    var body = '<nav class="c-toc"><a href="#/c/rules?s=t">特定商取引法に基づく表記</a><a href="#/c/rules?s=p">プライバシーポリシー</a><a href="#/c/rules?s=c">キャンセル・取り消しの決まり</a></nav>' +
      '<section class="c-sec" id="r-t"><h2>特定商取引法に基づく表記</h2>' + kv(toko) + '</section>' +
      '<section class="c-sec" id="r-p"><h2>プライバシーポリシー</h2><p class="c-rule">' + ui.br(L.privacy) + '</p></section>' +
      '<section class="c-sec" id="r-c"><h2>キャンセル・取り消しの決まり</h2><p class="c-rule">' + ui.br(L.cancel) + '</p></section>' +
      '<p class="help">' + esc(L.version || '') + '</p>';
    return page({ back: '#/c', title: '決まり', body: body });
  }

  /* ================= 住所 → 画面 ================= */
  var ROUTES = {
    '': c00, line: function (r, p) { return c01(p.next || 'c'); }, school: function (r, p, b) { return r[0] ? c11(r, p, b) : c10(r, p, b); },
    item: c12, reserve: c18, cart: c13, checkout: c14, confirm: c15, pay: c16, done: c17, wait: c20, restock: c21,
    measure: c25, 'measure-form': c26, salon: function (r, p, b) { return r[0] ? c31(r, p, b) : c30(r, p, b); }, 'salon-form': c32, 'salon-confirm': c33,
    my: function (r, p, b) { return r[0] ? c41(r, p, b) : c40(r, p, b); }, voice: c50, rules: c60
  };
  /* LINEの外の人に一度だけ C01 を出す入口 */
  var GUIDE = { school: 'order', item: 'order', salon: 'salon', measure: 'measure' };

  /* 起動：覚えた中身があればすぐ出し、裏で新しくする（お客様の情報は新しい中身が届いてから入る） */
  function boot() {
    var gas = KS.config.backend === 'gas';
    if (gas && B && !B._kept && Date.now() - bootAt < 300000) return Promise.resolve(B);
    return fast('boot', null, function (r) {
      var was = B && B._kept;
      B = r; bootAt = Date.now();
      /* 覚えた中身で出していた画面に、お客様の情報（入力欄の名前・電話など）を入れ直す */
      if (was && r.profile && !typing()) KS.app.render();
    }).then(function (r) {
      if (!r.ok) return r;
      if (r._kept) {
        if (B && !B._kept) return B;   /* 新しい中身がもう届いている */
        r.inLine = KS.line.inClient() && !!KS.line.idToken(); r.profile = null;
      } else bootAt = Date.now();
      B = r;
      return r;
    });
  }
  function route(rest, params) {
    var h = cur();
    if (trouble && trouble.hash !== h) trouble = null;
    if (flash && flash.hash !== h) flash = null;
    nextFormKey = ''; nextReceive = '';
    prefetch(rest);
    return boot().then(function (b) {
      if (!b.ok) return c90('net');
      if (trouble) return c90(trouble.kind, trouble);
      var k = rest[0] || '';
      if (!b.inLine && !ui.keep('lineGuideDone') && GUIDE[k] && b.stages[GUIDE[k]]) return c01(location.hash.replace(/^#\/?/, ''));
      var fn = ROUTES[k];
      if (!fn) return c90('notfound');
      return fn(rest.slice(1), params || {}, b);
    }).catch(function (e) { if (window.console) console.error(e); return c90('net'); });
  }

  /* 描いたあと：入力欄の受け口・残り時間・受付のあとのLINE */
  var sentIds = {};
  function after(rest, params) {
    formKey = nextFormKey;
    if (timer) { clearInterval(timer); timer = null; }
    if (document.querySelector('[data-until]')) timer = setInterval(tick, 1000);
    if (params && params.s) { var t = document.getElementById('r-' + params.s); if (t) t.scrollIntoView(); }
    if (nextReceive && !sentIds[nextReceive]) {
      var id = nextReceive; sentIds[id] = 1;
      try { if (sessionStorage.getItem('ks_sent_' + id)) return; sessionStorage.setItem('ks_sent_' + id, '1'); } catch (e) { }
      KS.line.afterReceive(id);
    }
  }
  function tick() {
    var els = document.querySelectorAll('[data-until]');
    if (!els.length) { clearInterval(timer); timer = null; return; }
    var now = Date.now();
    for (var i = 0; i < els.length; i++) {
      var el = els[i], ms = +el.dataset.until - now;
      if (ms <= 0) { clearInterval(timer); timer = null; if (el.dataset.reload) KS.app.render(); return; }
      el.textContent = left(ms);
    }
  }
  function onInput(e) {
    var el = e.target;
    if (!formKey || !el.dataset || !el.dataset.f || !el.closest || !el.closest('#scr')) return;
    dr(formKey)[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
    saveDraft();
  }
  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);

  /* ================= 操作 ================= */
  function addLines(lines) {
    var i = 0, fails = [];
    function next() {
      if (i >= lines.length) return Promise.resolve(fails);
      var l = lines[i++];
      return call('cartAdd', { productId: l.productId, size: l.size, qty: l.qty, cartId: cartId() }).then(function (r) { if (!r.ok) fails.push(l.label || l.size); return next(); });
    }
    return next();
  }
  var actions = {
    cRetry: function () { trouble = null; },
    /* 左上の戻る（決まりは app.js の back） */
    cBack: function (el) { KS.app.back(el.dataset.to); return false; },
    cLineSkip: function (el) { ui.keep('lineGuideDone', 1); return go(el.dataset.next || 'c'); },
    cLineOpen: function (el) { KS.line.openInLine(el.dataset.next || ''); return false; },
    /* 選ぶボタン（受け取り方・支払い・送り方・受け取りの日） */
    cSet: function (el) { dr(el.dataset.s)[el.dataset.k] = el.dataset.v; if (errs[el.dataset.s]) delete errs[el.dataset.s][el.dataset.k]; saveDraft(); },
    /* C12 サイズと数 */
    cSize: function (el) {
      var pid = el.dataset.pid, s = dr('sel'), o = s[pid] || {};
      s[pid] = { size: el.dataset.v, qty: o.size === el.dataset.v ? o.qty : 1 }; saveDraft();
      if (location.hash.indexOf('?') >= 0) { KS.app.replace('c/item/' + seg(pid)); return false; }
    },
    cSelQty: function (el) {
      var s = dr('sel'), o = s[el.dataset.pid] || (s[el.dataset.pid] = {});
      o.qty = Math.max(1, Math.min(9, (o.qty || 1) + (+el.dataset.d))); saveDraft();
    },
    cAdd: function (el) {
      var pid = el.dataset.pid, size = el.dataset.size, key = el.dataset.key || pid, s = dr('sel'), qty = (s[key] || {}).qty || 1;
      return call('cartAdd', { productId: pid, size: size, qty: qty, cartId: cartId() }).then(function (r) {
        if (r.ok) { delete s[key]; saveDraft(); ui.toast('かごに入れました'); return go('c/cart'); }
        if (r.code === 'soldout') {
          if (r.free > 0) { ui.toast(r.message); return; }
          setFlash('c/wait/' + pid + '/' + size, 'warn', r.message); return go('c/wait/' + seg(pid) + '/' + seg(size));
        }
        if (r.code === 'measure') { ui.toast(r.message); return go('c/measure'); }
        return actFail(r);
      });
    },
    /* C13 数の増減・外す */
    cQty: function (el) {
      var q = Math.max(0, (+el.dataset.q) + (+el.dataset.d));
      return call('cartSet', { holdId: el.dataset.hold, qty: q, cartId: cartId() }).then(function (r) {
        if (!r.ok) return r.code === 'soldout' ? ui.toast('これ以上はご用意できません') : actFail(r);
        if (!q) ui.toast('かごから外しました');
      });
    },
    /* C14 → C15 */
    cCoNext: function () {
      return call('checkoutInfo', { cartId: cartId() }).then(function (res) {
        if (!res.ok) return actFail(res);
        var co = dr('co'), e = checkCo(co, res.profile.inLine, res.cart.count, res.ship);
        errs.co = e;
        if (Object.keys(e).length) { ui.toast('入力を確かめてください'); return; }
        errs.confirm = {}; return go('c/confirm');
      });
    },
    /* C15 → C16／C17 */
    cPlace: function () {
      var co = dr('co'), f = {};
      for (var k in co) if (k.charAt(0) !== '_') f[k] = co[k];
      f.pay = co.method === '配送' ? '事前' : (co.pay === '事前' ? '事前' : '店頭');
      return call('placeOrder', { cartId: cartId(), form: f, utm: KS.app.utm() }).then(function (r) {
        if (r.ok) {
          D.lastOrder = { token: r.order.token, lines: r.order.lines.map(function (l) { return { productId: l.productId, size: l.size, qty: l.qty, label: l.label }; }) };
          D.co = {}; D.cartSeen = null; errs.co = {}; errs.confirm = {}; saveDraft();
          if (r.payUrl) { if (r.payUrl.charAt(0) === '#') KS.app.replace(r.payUrl); else location.href = r.payUrl; return false; }
          return done('c/done/order/' + seg(r.order.token));
        }
        if (r.code === 'input') {
          var e = r.errors || {}, onlyAgree = Object.keys(e).every(function (x) { return x === 'agree'; });
          errs.confirm = { agree: e.agree }; errs.co = e;
          ui.toast(r.message);
          if (!onlyAgree) return go('c/checkout');
          return;
        }
        if (r.code === 'lost' || r.code === 'empty') { setFlash('c/cart', 'warn', r.message); return go('c/cart'); }
        if (r.code === 'pay' || r.code === 'closed') { trouble = { hash: cur(), kind: 'other', msg: r.message }; return; }
        return actFail(r);
      });
    },
    /* C16（このPCの中で動かすとき） */
    cPay: function (el) {
      var token = el.dataset.token, paid = el.dataset.paid === '1';
      if (!paid && !ui.confirm('お支払いをやめて、取り置きを取り消しますか？')) return false;
      return call('devPay', { token: token, paid: paid }).then(function (r) {
        if (r.ok) return done('c/done/order/' + seg(token));
        if (r.code === 'expired') { trouble = { hash: cur(), kind: paid ? 'expired' : 'payStopped', msg: r.message }; return; }
        return actFail(r);
      });
    },
    cReAdd: function () {
      var lines = (D.lastOrder && D.lastOrder.lines) || [];
      return addLines(lines).then(function (fails) {
        D.lastOrder = null; saveDraft(); trouble = null;
        if (fails.length) setFlash('c/cart', 'warn', '在庫が無くなったため、入れ直せなかった品があります：' + fails.join('、'));
        return go('c/cart');
      });
    },
    /* C20 */
    cWait: function (el) {
      var pid = el.dataset.pid, size = el.dataset.size, w = dr('wait');
      return call('waitAdd', { productId: pid, size: size, email: w.email || '' }).then(function (r) {
        if (r.ok) { (D.waitDone || (D.waitDone = {}))[pid + '|' + size] = { already: !!r.already, channel: r.wait.channel }; errs.wait = {}; saveDraft(); return; }
        if (r.code === 'input') { errs.wait = r.errors || {}; ui.toast(r.message); return; }
        return actFail(r);
      });
    },
    /* C25 → C26 */
    cMeasurePick: function (el) {
      var d = el.dataset, m = dr('measure');
      m.slotId = d.id; m.schoolId = d.school; m.schoolName = d.name; m.date = d.date; m.start = +d.start; m.end = +d.end; saveDraft();
      errs.measure = {}; return go('c/measure-form/' + seg(d.id));
    },
    cMeasureNext: function () {
      var m = dr('measure'), e = checkMeasure(m, B && B.inLine);
      errs.measure = e;
      if (Object.keys(e).length) { ui.toast('入力を確かめてください'); return; }
      return go('c/measure-form/' + seg(m.slotId) + '?check=1');
    },
    cMeasureBook: function () {
      var m = dr('measure'), f = {};
      ['slotId', 'schoolId', 'count', 'children', 'name', 'phone', 'email', 'note', 'agree'].forEach(function (k) { f[k] = m[k]; });
      return call('measureBook', { form: f, utm: KS.app.utm() }).then(function (r) {
        if (r.ok) { D.measure = {}; errs.measure = {}; saveDraft(); return done('c/done/measure/' + seg(r.booking.token)); }
        if (r.code === 'input') {
          var e = r.errors || {}; errs.measure = e; ui.toast(r.message);
          if (Object.keys(e).some(function (x) { return x !== 'agree'; })) return go('c/measure-form/' + seg(m.slotId));
          return;
        }
        if (r.code === 'slot') { setFlash('c/measure/' + m.schoolId, 'warn', r.message); m.slotId = ''; saveDraft(); return go('c/measure/' + seg(m.schoolId)); }
        if (r.code === 'closed') { trouble = { hash: cur(), kind: 'closed', msg: r.message }; return; }
        return actFail(r);
      });
    },
    cJump: function (el) { var t = document.getElementById(el.dataset.to); if (t) t.scrollIntoView({ behavior: 'smooth' }); return false; },
    /* C12 → C18 予約 */
    cRsvAdd: function (el) {
      var d = el.dataset, rv = rsv(), s = dr('sel'), qty = (s[d.pid] || {}).qty || 1;
      if (rv.schoolId && rv.schoolId !== d.school && rv.lines.length && !ui.confirm('ほかの学校の品が予約に入っています。入れ替えますか？')) return false;
      if (rv.schoolId !== d.school) { rv.lines = []; rv.schoolId = d.school; }
      var same = rv.lines.filter(function (l) { return l.productId === d.pid && l.size === d.size; })[0];
      if (same) same.qty = Math.min(9, same.qty + qty);
      else rv.lines.push({ productId: d.pid, size: d.size, qty: qty, label: d.label, price: +d.price });
      delete s[d.pid]; saveDraft(); ui.toast('予約に入れました');
      return go('c/school/' + seg(d.school));
    },
    cRsvQty: function (el) {
      var rv = rsv(), i = +el.dataset.i, l = rv.lines[i]; if (!l) return;
      var q = Math.max(0, Math.min(9, l.qty + (+el.dataset.d)));
      if (!q) { rv.lines.splice(i, 1); ui.toast('予約から外しました'); } else l.qty = q;
      saveDraft();
    },
    cRsvPlace: function () {
      var rv = rsv(), f0 = dr('rsvf'), f = { schoolId: rv.schoolId };
      for (var k in f0) if (k.charAt(0) !== '_') f[k] = f0[k];
      var e = checkRsv(f, B && B.inLine); errs.rsvf = e;
      if (Object.keys(e).length) { ui.toast('入力を確かめてください'); return; }
      return call('preorder', { lines: rv.lines.map(function (l) { return { productId: l.productId, size: l.size, qty: l.qty }; }), form: f, utm: KS.app.utm() }).then(function (r) {
        if (r.ok) { D.rsv = { schoolId: rv.schoolId, lines: [] }; D.rsvf = { _filled: 1, name: f.name, kana: f.kana, phone: f.phone, email: f.email }; errs.rsvf = {}; saveDraft(); return done('c/done/order/' + seg(r.order.token)); }
        if (r.code === 'input') { errs.rsvf = r.errors || {}; ui.toast(r.message); return; }
        if (r.code === 'closed') { trouble = { hash: cur(), kind: 'closed', msg: r.message }; return; }
        return actFail(r);
      });
    },
    /* C30〜C33 */
    cMenu: function (el) {
      var s = dr('salon');
      if (s.menuId !== el.dataset.id) { s.menuId = el.dataset.id; s.date = ''; s.start = null; }
      D.move = null; saveDraft();
      return go('c/salon/' + seg(el.dataset.id));
    },
    cWeek: function (el) {
      var s = dr('salon'), today = (B && B.today) || u.nowOf(Date.now()).date, base = s.from && s.from >= today ? s.from : today;
      var f = u.addDays(base, +el.dataset.d); s.from = f < today ? today : f; saveDraft();
    },
    cSlot: function (el) { var s = dr('salon'); s.date = el.dataset.date; s.start = +el.dataset.start; saveDraft(); },
    cSalonNext: function () {
      var e = checkSalon(dr('sf'), B && B.inLine);
      errs.sf = e;
      if (Object.keys(e).length) { ui.toast('入力を確かめてください'); return; }
      errs.sconf = {}; return go('c/salon-confirm');
    },
    cSalonBook: function () {
      var s = dr('salon'), f = dr('sf'), form = { menuId: s.menuId, date: s.date, start: s.start };
      ['name', 'kana', 'phone', 'email', 'heardFrom', 'note', 'agree'].forEach(function (k) { form[k] = f[k]; });
      return call('salonBook', { form: form, utm: KS.app.utm() }).then(function (r) {
        if (r.ok) { D.salon = {}; D.sf = {}; errs.sf = {}; errs.sconf = {}; saveDraft(); return done('c/done/salon/' + seg(r.booking.token)); }
        if (r.code === 'input') {
          var e = r.errors || {}; errs.sf = e; errs.sconf = { agree: e.agree }; ui.toast(r.message);
          if (Object.keys(e).some(function (x) { return x !== 'agree'; })) return go('c/salon-form');
          return;
        }
        if (r.code === 'slot') { s.date = ''; s.start = null; saveDraft(); setFlash('c/salon/' + s.menuId, 'warn', r.message); return go('c/salon/' + seg(s.menuId)); }
        if (r.code === 'first' || r.code === 'menu') { s.menuId = ''; saveDraft(); setFlash('c/salon', 'warn', r.message); return go('c/salon'); }
        if (r.code === 'closed') { trouble = { hash: cur(), kind: 'closed', msg: r.message }; return; }
        return actFail(r);
      });
    },
    /* C41 取り消し・日時の変更 */
    cCancel: function (el) {
      if (!ui.confirm(el.dataset.label + '。よろしいですか？')) return false;
      return call('cancel', { kind: el.dataset.kind, token: el.dataset.token }).then(function (r) {
        if (r.ok) { if (r.id) KS.line.afterReceive(r.id); ui.toast('取り消しました'); return; }
        if (r.code === 'call' || r.code === 'state') { setFlash(cur().slice(2), 'warn', r.message); return; }
        return actFail(r);
      });
    },
    cMoveStart: function (el) {
      D.move = { token: el.dataset.token, id: el.dataset.id, menuId: el.dataset.menu };
      D.salon = { menuId: el.dataset.menu, from: '' }; saveDraft();
      return go('c/salon/' + seg(el.dataset.menu) + '?move=' + seg(el.dataset.token));
    },
    cMove: function () {
      var mv = D.move, s = dr('salon');
      if (!mv) return go('c/my');
      return call('salonMove', { token: mv.token, date: s.date, start: s.start }).then(function (r) {
        if (r.ok) { KS.line.afterReceive(r.booking.id); D.move = null; D.salon = {}; saveDraft(); ui.toast('日時を変えました'); return go('c/my/salon/' + seg(mv.token)); }
        if (r.code === 'slot') { s.date = ''; s.start = null; saveDraft(); ui.toast(r.message); return; }
        if (r.code === 'call') { setFlash('c/my/salon/' + mv.token, 'warn', r.message); return go('c/my/salon/' + seg(mv.token)); }
        return actFail(r);
      });
    },
    /* C50 */
    cStar: function (el) { dr('voice').stars = +el.dataset.n; if (errs.voice) errs.voice = {}; saveDraft(); },
    cVoice: function (el) {
      var v = dr('voice'), token = el.dataset.token || '';
      if (!v.stars) { errs.voice = { stars: '星をえらんでください。' }; return; }
      return call('voice', { token: token, stars: v.stars, text: v.text || '', toShop: v.toShop || '' }).then(function (r) {
        if (!r.ok) { if (r.code === 'input') { errs.voice = { stars: r.message }; return; } return actFail(r); }
        (D.voiceDone || (D.voiceDone = {}))[token || 'qr'] = { googleUrl: r.googleUrl || '' }; D.voice = {}; saveDraft();
      });
    }
  };

  return { route: route, actions: actions, after: after };
})();
