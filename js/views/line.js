/* ココスポーツ 本番：試しのLINEのトーク画面（#/l。backend が 'local' のときだけ。本番では出ない）
   - 公式LINE（@140epmxr）を友だちのスマホで開いたときの見え方を、このPCの中で試す
   - 真ん中：あいさつ（L1）と、試しの道具で選んだ人あての LINE（受付の確認・前日・入荷のお知らせ＝L4）を時系列に
   - 下：段階2のリッチメニュー（6つ）。押すとお客様の画面へ（本番は LIFF の住所。KS.line.url）
   - 入力欄：段階2の自動の返事（L3）をこの画面の中だけで返す（見せかけ。core には足さない）
   段階2のあいさつ・自動の返事の文の原本はここの texts()。docs/LINEとお客様の画面をつなぐ手順.md に同じ文がある（変えるときは両方） */
KS.views.l = (function () {
  if (KS.config.backend === 'gas') return null;
  var ui = KS.ui, esc = ui.esc, ico = ui.ico, L = KS.local, u = KS.core.u;

  /* 段階2のリッチメニュー（大・6分割。tools/make_richmenu_v03.py と同じ並び） */
  var MENU = [
    { label: '体操服・制服', sub: '取り置き・入荷のお知らせ', ico: 'shirt', path: 'c/school', tone: 'pink' },
    { label: '採寸の予約', sub: '中学校の制服', ico: 'ruler', path: 'c/measure' },
    { label: '水素サロン', sub: 'ご予約はこちら', ico: 'drop', path: 'c/salon', tone: 'navy' },
    { label: 'わたしの予約', sub: '確認・取り消し', ico: 'cal', path: 'c/my' },
    { label: 'Instagram', sub: '新商品・営業日のお知らせ', ico: 'insta', ext: 'https://www.instagram.com/_kokosports/' },
    { label: 'お店の情報', sub: '場所・営業時間・電話', ico: 'pin', say: 'お店' }
  ];

  var TEL = '0299-92-0272', HOURS = '営業時間 10:00〜18:00（木曜・日曜は定休）',
    ADDR = '茨城県神栖市平泉302-7 ミヨヒコBASE-D',
    MAP = 'https://www.google.com/maps/search/?api=1&query=%E8%8C%A8%E5%9F%8E%E7%9C%8C%E7%A5%9E%E6%A0%96%E5%B8%82%E5%B9%B3%E6%B3%89302-7%20%E3%82%B3%E3%82%B3%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%84';

  /* 段階2の文。住所は KS.line.url（LIFF ID があれば https://liff.line.me/<LIFF_ID>/#/…） */
  function texts() {
    var U = KS.line.url;
    return {
      greeting: 'ココスポーツです。友だち追加ありがとうございます。\n' +
        '制服・体操服の取り扱い店で、水素サロンを併設しています。\n' +
        '下のメニューから、次のことができます。\n' +
        '・小学校4校の体操服の料金表\n' +
        '・在庫の確認とお取り置き（年明けから）\n' +
        '・採寸・水素サロンのネットのご予約（近日公開）\n' +
        '受付の確認や入荷のお知らせは、このLINEでお届けします。\n' +
        HOURS + '\n' +
        'お問い合わせはお電話で：' + TEL + '\n' +
        'お知らせは月に数回までです。',
      replies: {
        '体操服': '体操服・上履きの取り扱い校です。\n' +
          '・息栖小学校　・深芝小学校\n' +
          '・大野原小学校　・大野原西小学校\n' +
          'お買い上げの方に、キャラクタータオルとネーム名札をプレゼント中です（なくなり次第終了）。\n' +
          '学校を選ぶと、品物とサイズごとの価格が見られます。在庫の確認とお取り置きは、年明けから始まります。\n' +
          U('c/school') + '\n' +
          'ご来店をお待ちしています（10:00〜18:00、木曜・日曜は定休）。',
        '採寸': '中学校の制服の採寸のご予約です。\n' +
          '学校ごとの採寸の日程から、ご都合の良い時間をお選びください。\n' +
          U('c/measure') + '\n' +
          '日程がまだの学校は、決まり次第このLINEでお知らせします。\n' +
          'お急ぎの方はお電話で：' + TEL,
        '水素': '水素サロンのご予約は、こちらから空いている時間をお選びください。\n' +
          U('c/salon') + '\n' +
          'お電話でも承ります：' + TEL,
        '予約': 'ご予約の確認・取り消しは「わたしの予約」から。\n' +
          U('c/my') + '\n' +
          '新しくご予約するときは、こちらから。\n' +
          '・体操服・制服の取り置き\n' + U('c/school') + '\n' +
          '・水素サロン\n' + U('c/salon') + '\n' +
          'お電話でも承ります：' + TEL,
        'お店': 'ココスポーツ\n' +
          ADDR + '\n' +
          HOURS + '\n' +
          '電話 ' + TEL + '\n' +
          '地図 ' + MAP + '\n' +
          '臨時のお休みは、こちらでお知らせしています。\n' +
          U('c')
      },
      other: 'メッセージありがとうございます。このLINEではお返事ができないため、お問い合わせはお電話（' + TEL + '）でお願いいたします。\n' +
        HOURS + '\n' +
        '取り置き・ご予約は、下のメニューか、こちらからできます。\n' +
        U('c')
    };
  }
  /* 自動の返事：公式LINEの応答メッセージと同じく、言葉がぴったり同じときだけ。ほかはキーワードなしの返事 */
  function answer(text) {
    var t = texts(), k = String(text).trim();
    return Object.prototype.hasOwnProperty.call(t.replies, k) ? t.replies[k] : t.other;
  }

  /* この画面で打った言葉と返事（その人ごと。PCの中だけ）。ob は打ったときの「届いたもの」の数（並べる位置） */
  function talkAll() { return ui.keep('lnTalk') || {}; }
  function talkOf(as) { return talkAll()[as] || []; }
  function setTalk(as, list) { var a = talkAll(); a[as] = list; ui.keep('lnTalk', a); }
  var menuOpen = ui.keep('lnMenu') !== false, refocus = false;

  /* 文の中の住所を押せるようにする（このページの住所は同じタブ、外は新しいタブ） */
  function linkify(text) {
    var here = location.origin + location.pathname;
    return ui.br(text).replace(/https?:\/\/[^\s<]+/g, function (m) {
      var raw = m.replace(/&amp;/g, '&'), same = raw.indexOf(here) === 0;
      return '<a href="' + m + '"' + (same ? '' : ' target="_blank" rel="noopener"') + '>' + m + '</a>';
    });
  }

  /* トークの並び：届いたもの（古い順）と、ここで打った言葉を、打ったときの位置で混ぜる */
  function items(as) {
    var box = L.dev.outbox().slice().reverse(), lineId = as.indexOf('line:') === 0 ? as.slice(5) : '';
    var mine = talkOf(as).slice(), out = [];
    box.forEach(function (m, i) {
      while (mine.length && mine[0].ob <= i) out.push(mine.shift());
      if (!lineId || m.via !== 'LINE' || m.to !== lineId) return;
      /* 受付の確認は、画面がトークに「【受付】番号」を送り、その返信で届く */
      if (m.mode === 'reply') out.push({ from: 'me', at: m.at, text: '【受付】' + (m.ref || (/受付番号\s*([A-Za-z0-9\-]+)/.exec(m.text) || ['', ''])[1]), auto: true });
      out.push({ from: 'shop', at: m.at, text: m.text, kind: m.kind, mode: m.mode });
    });
    return out.concat(mine);
  }

  function bubble(x) {
    var tm = '<span class="ln-tm">' + esc(String(x.at || '').slice(11)) + '</span>';
    if (x.from === 'me') return '<div class="ln-row me">' + tm + '<div class="ln-bub me">' + linkify(x.text) + '</div></div>';
    var tag = x.mode === 'push' ? '<span class="ln-tag">1通</span>' : x.mode === 'reply' ? '<span class="ln-tag">返信・0通</span>' : '';
    return '<div class="ln-row shop"><span class="ln-av">ココ</span><div class="ln-bub shop">' + linkify(x.text) + '</div>' + tm + tag + '</div>';
  }

  function route() {
    var s = L.dev.state(), as = s.dev.as, list = items(as);
    var who = as === 'web' ? '' : (L.dev.lineUsers().filter(function (x) { return x.as === as; })[0] || { name: '新しい友だち' }).name;
    var day = '', body = '<div class="ln-sys">ココスポーツと友だちになりました</div>' +
      '<div class="ln-row shop"><span class="ln-av">ココ</span><div class="ln-bub shop">' + linkify(texts().greeting) + '</div><span class="ln-tag">あいさつ・0通</span></div>';
    if (as === 'web') body += '<div class="ln-sys">いまは「LINEの外の人」で開いています。右の試しの道具で LINE の友だちを選ぶと、その人のトークになります。</div>';
    list.forEach(function (x) {
      var d = String(x.at || '').slice(0, 10);
      if (d && d !== day) { day = d; body += '<div class="ln-day">' + esc(u.jpDate(d)) + '</div>'; }
      body += bubble(x);
    });
    var menu = '<div class="ln-menu" role="group" aria-label="リッチメニュー">' + MENU.map(function (m) {
      var inner = ico(m.ico, 'lg') + '<b>' + esc(m.label) + '</b><small>' + esc(m.sub) + '</small>';
      var cls = 'ln-tile' + (m.tone ? ' ' + m.tone : '');
      if (m.ext) return '<a class="' + cls + '" href="' + esc(m.ext) + '" target="_blank" rel="noopener">' + inner + '</a>';
      if (m.say) return '<button type="button" class="' + cls + '" data-act="lnSay" data-text="' + esc(m.say) + '">' + inner + '</button>';
      return '<a class="' + cls + '" href="#/' + esc(m.path) + '">' + inner + '</a>';
    }).join('') + '</div>';
    return '<div class="ln-hd"><a class="ln-back" href="#/c" aria-label="お客様の画面へ">' + ico('back') + '</a>' +
      '<div class="ln-name"><b>ココスポーツ</b><small>' + (who ? '試し：' + esc(who) + 'さんのトーク' : '試し：LINEの外の人') + '</small></div>' +
      '<button type="button" class="linkbtn ln-clear" data-act="lnClear">打った言葉を消す</button></div>' +
      '<div class="ln-talk" id="ln-talk">' + body + '</div>' +
      '<div class="ln-foot">' +
      '<div class="ln-hint">「体操服」「採寸」「水素」「予約」「お店」と送ると自動の返事（言葉がぴったり同じときだけ）。ほかの言葉はキーワードなしの返事</div>' +
      '<div class="ln-input"><input id="ln-in" class="inp" type="text" placeholder="メッセージを入力" autocomplete="off" enterkeyhint="send" aria-label="メッセージ">' +
      '<button type="button" class="btn pri" id="ln-send" data-act="lnSend">送信</button></div>' +
      (menuOpen ? menu : '') +
      '<button type="button" class="ln-bar" data-act="lnMenu" aria-expanded="' + menuOpen + '">メニュー ' + (menuOpen ? '▼' : '▲') + '</button>' +
      '</div>';
  }

  function after() {
    var t = document.getElementById('ln-talk');
    if (t) t.scrollTop = t.scrollHeight;
    var inp = document.getElementById('ln-in');
    if (!inp) return;
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); var b = document.getElementById('ln-send'); if (b) b.click(); }
    });
    if (refocus) { refocus = false; inp.focus(); }
  }

  function say(text) {
    text = String(text || '').trim();
    if (!text) return false;
    var as = L.dev.state().dev.as, at = u.stamp(L.dev.now().ts), ob = L.dev.outbox().length;
    var list = talkOf(as);
    list.push({ from: 'me', at: at, text: text.slice(0, 500), ob: ob });
    list.push({ from: 'shop', at: at, text: answer(text), ob: ob, mode: 'reply' });
    setTalk(as, list.slice(-60));
  }

  var actions = {
    lnSend: function () { var inp = document.getElementById('ln-in'); refocus = true; return say(inp ? inp.value : ''); },
    lnSay: function (el) { return say(el.dataset.text); },
    lnMenu: function () { menuOpen = !menuOpen; ui.keep('lnMenu', menuOpen); },
    lnClear: function () { setTalk(L.dev.state().dev.as, []); ui.toast('打った言葉を消しました'); }
  };

  return { route: route, after: after, actions: actions, texts: texts, menu: MENU };
})();
