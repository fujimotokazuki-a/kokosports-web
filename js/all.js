var KS = window.KS || {};
window.KS = KS;
/* 本番（tools/deploy_pages.py が作る。手で直さない） */
KS.config = {
  backend: 'gas',
  gasUrl: 'https://script.google.com/macros/s/AKfycbzi4Cwf_Z5btVH24jZEWrMI-KUOiUSGqgP1OcN3cpDWGNQG42MYxdKVWOC9OkrKdJr6/exec',
  liffId: '2012312775-D8OhMrMP',
  googleClientId: '604466080002-n6f4ik9c4u4mt5qkuslo2numg7bpr5s0.apps.googleusercontent.com',
  baseUrl: 'https://fujimotokazuki-a.github.io/kokosports-web/'
};

;
/* ココスポーツ 本番：共通の土台（ブラウザと Apps Script の両方で動く。DOM を使わない）
   - 日付は 'YYYY-MM-DD'、時刻は 0時からの分。日本時間だけを扱う
   - ここから下の core/*.js は、tools/build_gas.py で Apps Script にそのまま写す */
var KS = (typeof globalThis !== 'undefined' ? globalThis : this).KS || {};
(typeof globalThis !== 'undefined' ? globalThis : this).KS = KS;
KS.core = KS.core || {};

KS.core.u = (function () {
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymdOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymdOf(d); }
  function wd(s) { return parse(s).getDay(); }
  function hm(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function toMin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function daysBetween(a, b) { return Math.round((parse(b) - parse(a)) / 86400000); }
  function jpDate(s) { var d = parse(s); return (d.getMonth() + 1) + '月' + d.getDate() + '日(' + WD[d.getDay()] + ')'; }
  function shortDate(s) { var d = parse(s); return (d.getMonth() + 1) + '/' + d.getDate() + '(' + WD[d.getDay()] + ')'; }
  function yen(n) { return (Math.round(n) || 0).toLocaleString('ja-JP') + '円'; }
  function num(n) { return (Math.round(n) || 0).toLocaleString('ja-JP'); }
  function month(s) { return String(s).slice(0, 7); }

  /* 日本時間の「いま」：{date, min, ts}。ts はミリ秒 */
  function nowOf(ts) {
    var d = new Date(ts + 9 * 3600000);
    var date = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    return { date: date, min: d.getUTCHours() * 60 + d.getUTCMinutes(), ts: ts };
  }
  /* 日付と分 → ミリ秒（日本時間） */
  function tsOf(date, min) {
    var p = String(date).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2], 0, min || 0) - 9 * 3600000;
  }
  function stamp(ts) { var n = nowOf(ts); return n.date + ' ' + hm(n.min); }

  function zen2han(s) { return String(s || '').replace(/[０-９Ａ-Ｚａ-ｚ＠．－]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0xFEE0); }); }
  function normPhone(s) { return zen2han(s).replace(/[^0-9]/g, ''); }
  function normEmail(s) { return zen2han(s).trim().toLowerCase(); }
  function normKana(s) {
    return String(s || '').trim().replace(/[ぁ-ゖ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) + 0x60); }).replace(/\s+/g, ' ');
  }
  function okPhone(p) { p = normPhone(p); return p.length >= 10 && p.length <= 11; }
  function okEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normEmail(e)); }
  function okZip(z) { return /^\d{7}$/.test(normPhone(z)); }

  function token() {
    var a = 'abcdefghjkmnpqrstuvwxyz23456789', s = '';
    for (var i = 0; i < 24; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function by(key) { return function (a, b) { return a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0; }; }
  function sum(arr, f) { var t = 0; for (var i = 0; i < arr.length; i++) t += f ? f(arr[i]) : arr[i]; return t; }

  /* 画面に返すエラー。code は画面の分かれ道に使う */
  function fail(message, code, extra) {
    var e = { ok: false, message: message, code: code || 'ng' };
    if (extra) for (var k in extra) e[k] = extra[k];
    return e;
  }

  return {
    WD: WD, pad: pad, ymdOf: ymdOf, parse: parse, addDays: addDays, wd: wd, hm: hm, toMin: toMin, daysBetween: daysBetween,
    jpDate: jpDate, shortDate: shortDate, yen: yen, num: num, month: month, nowOf: nowOf, tsOf: tsOf, stamp: stamp,
    normPhone: normPhone, normEmail: normEmail, normKana: normKana, okPhone: okPhone, okEmail: okEmail, okZip: okZip,
    token: token, clone: clone, by: by, sum: sum, fail: fail
  };
})();

;
/* ココスポーツ 本番：表の形と、最初に入れておく値
   - 表の正本は、店のGoogleアカウントのスプレッドシート（試しの形ではブラウザの中）
   - 小学校4校の品物と価格は、お店の価格表（2026-11-01）どおり。中学校・反射タスキ・帽子・上履きは「仮」で、届いたら S08 設定 で入れ替える
   - 在庫は S05 在庫 で入れる */
KS.core.model = (function () {
  /* 表の名前と、主キー。Apps Script では同じ名前のシートになる */
  var TABLES = {
    settings: 'key', schools: 'id', products: 'id', stock: 'id', customers: 'id', holds: 'id', orders: 'id',
    waits: 'id', measureSlots: 'id', measureBookings: 'id', salonMenus: 'id', salonBookings: 'id', salonBlocks: 'id',
    holidays: 'date', notices: 'id', reviews: 'id', audit: 'id'
  };

  /* 設定（S08 で変えられる）。値はすべて JSON にして1行ずつ持つ */
  function settings() {
    return {
      shop: {
        name: 'ココスポーツ', address: '茨城県神栖市平泉302-7 ミヨヒコBASE-D', tel: '0299-92-0272',
        hours: '10:00〜18:00', closedText: '木曜・日曜は定休',
        instagram: 'https://www.instagram.com/_kokosports/',
        map: 'https://www.google.com/maps/search/?api=1&query=%E8%8C%A8%E5%9F%8E%E7%9C%8C%E7%A5%9E%E6%A0%96%E5%B8%82%E5%B9%B3%E6%B3%89302-7%20%E3%82%B3%E3%82%B3%E3%82%B9%E3%83%9D%E3%83%BC%E3%83%84',
        lineAddUrl: 'https://line.me/R/ti/p/@140epmxr', airReserve: 'https://airrsv.net/kokospo/calendar',
        googleReviewUrl: '', owner: '（お店に確認中）', manager: '（お店に確認中）'
      },
      /* 営業日：0=日〜6=土。木・日は休み */
      openDays: [1, 2, 3, 5, 6], open: 600, close: 1080,
      /* 作った段階のうち、お客様に見せるもの（画面遷移 v02 第5章）。
         price は料金表（学校・品物・サイズと価格）だけを見せる。order が外れていれば、在庫・かご・取り置き・入荷のお知らせは出さない */
      stages: { price: true, reserve: true, order: true, measure: true, ship: true, prepay: true, salon: true, voice: true },
      /* 予約（2026-11-01〜）：在庫を押さえずに受け付け、入荷のあと先着順にお渡しする。学校ごとに開ける（学校説明会の日に合わせる）。
         すぐ予約（品物とサイズを選んで予約）と、来店して試着（45分ごとの枠・1枠2組。試着30分＋間15分）の2つの道 */
      reserve: {
        schoolIds: ['onohara', 'onoharanishi'],
        handText: 'お渡しは2月から。入荷したあと、ご予約の先着順にご用意して、ご連絡します。',
        fit: { stepMin: 45, mins: 30, perSlot: 2, horizonDays: 30, leadMin: 120 }
      },
      /* まだ始めていない受付の案内（お客様の画面に出す） */
      opening: {
        order: '在庫の確認とお取り置きは、年明けから始まります。お買い求めは2月からの予定です。',
        orderShort: '年明けから受付',
        soon: 'ネットでの受付は、近日公開です。お急ぎの方はお電話でお問い合わせください。'
      },
      cart: { holdMin: 30, lowStock: 2 },
      pickup: { fromDays: 1, toDays: 21, keepDays: 7 },
      restock: { priorityHours: 24 },
      payment: { deadlineMin: 30 },
      ship: {
        methods: [
          { id: 'post', name: 'ポストに届く小さな荷物（厚さ3cmまで）', fee: 360, maxItems: 2 },
          { id: 'box', name: '宅配便（60サイズ）', fee: 930, maxItems: 99 }
        ],
        freeOver: 0, note: '送料は2026年10月の関東あての実費。お店の確認待ち'
      },
      salon: {
        seats: [{ id: 'S1', name: '水素マシーン1' }, { id: 'S2', name: '水素マシーン2' }],
        step: 30, deadlineMin: 120, cancelMin: 180, horizonDays: 30
      },
      line: { monthlyQuota: 200, stopReminderUnder: 30, dayBeforeAt: 1020 },
      voice: { askAfterVisit: true },
      /* 体操服のお買い上げプレゼント（お店の案内 2026-11-01）。品物ではなく、学校の品物の画面（C11）に出す案内 */
      campaign: {
        on: true, schoolIds: ['ikisu', 'fukashiba', 'onohara', 'onoharanishi'], title: '体操服のお買い上げプレゼント',
        text: 'お好きなキャラクターをお選びください。\n2枚お買い上げで：キャラクタータオル・水泳帽\n4枚お買い上げで：キャラクタータオル・赤白ぼうし・通学用名札（2年生〜6年生まで使用）\n6枚お買い上げで：キャラクタータオル・赤白ぼうし・上履き\n神栖市子育て応援券がご利用できます。'
      },
      /* お知らせの文（L4 とメール）。{名前} などは送るときに置き換える */
      templates: {
        order_received: '{名前}様\n取り置きのご予約を受け付けました。\n受付番号 {番号}\n{品物}\n受け取り：{受け取り}\n{支払い}\nご予約の確認・取り消しはこちら\n{リンク}',
        preorder_received: '{名前}様\n体操服のご予約を受け付けました。\n受付番号 {番号}\n{品物}\n合計 {合計}（お支払いはお渡しのときに店頭で）\n{お渡し}\n確認・取り消しはこちら\n{リンク}',
        preorder_ready: '{名前}様\nご予約の品が入荷し、ご用意ができました。\n受付番号 {番号}\n{品物}\n営業時間 {営業時間}（{定休}）にお越しください。',
        fit_received: '{名前}様\n試着のご来店のご予約を受け付けました。\n{学校}\n{日時}（{人数}人）\n試着のあと、そのままお店でご予約いただけます。\n{お渡し}\n確認・取り消しはこちら\n{リンク}',
        fit_dayBefore: '{名前}様\n明日 {日時} は、試着のご来店のご予約日です。\n{学校}（{人数}人）',
        order_paid: '{名前}様\nお支払いを確認しました。\n受付番号 {番号}\n{受け取り}',
        order_dayBefore: '{名前}様\n明日 {日付} は、取り置きの品のお受け取り日です。\n{品物}\n営業時間 {営業時間}（{定休}）',
        order_noShow: '{名前}様\n取り置きの品をお預かりしています。\n{品物}\n{期限} までにお受け取りがない場合は、取り置きを取り消します。\nご都合が悪い場合はお電話ください：{電話}',
        order_cancelled: '{名前}様\n取り置き（受付番号 {番号}）を取り消しました。\n{理由}',
        order_shipped: '{名前}様\nご注文の品を発送しました。\n受付番号 {番号}\n{配送}\n{追跡}',
        restock: '{品物}（サイズ {サイズ}）が入荷しました。\n{期限}まで、優先してお取り置きできます。\n{リンク}',
        measure_received: '{名前}様\n採寸のご予約を受け付けました。\n{学校}\n{日時}（{人数}人）\n確認・取り消しはこちら\n{リンク}',
        measure_dayBefore: '{名前}様\n明日 {日時} は採寸のご予約日です。\n{学校}（{人数}人）',
        salon_received: '{名前}様\n水素サロンのご予約を受け付けました。\n{メニュー}\n{日時}\nお支払いは店頭です。\n確認・変更・取り消しはこちら\n{リンク}',
        salon_changed: '{名前}様\nご予約の日時を変更しました。\n{メニュー}\n{日時}\n{リンク}',
        salon_cancelled: '{名前}様\nご予約（{日時}）を取り消しました。',
        salon_dayBefore: '{名前}様\n明日 {日時} に水素サロンのご予約があります。\n{メニュー}\nキャンセルは3時間前までにこちらから\n{リンク}'
      },
      legal: {
        tokushoho: '販売業者：ココスポーツ（正式な事業者名はお店に確認中）\n運営責任者：（お店に確認中）\n所在地：茨城県神栖市平泉302-7 ミヨヒコBASE-D\n電話：0299-92-0272（10:00〜18:00、木・日定休）\n販売価格：各品物の画面に表示（税込）\n送料：配送を選んだときに表示\n支払い：店頭（現金・カードなど、Airレジ）／ネットで事前（Square）\n引き渡し：店頭はご予約の受け取り日、配送はお支払いの確認から3営業日以内に発送\n返品・交換：未使用で受け取りから7日以内。サイズ交換は在庫があれば店頭で（配送の返品の送料はお客様負担。お店に確認中）',
        privacy: 'ココスポーツは、ご予約・取り置き・採寸・お知らせのために、お名前・電話番号・メールアドレス・LINEのユーザーIDをお預かりします。ほかの目的には使わず、法律で定める場合を除き第三者に渡しません。お問い合わせ：0299-92-0272',
        cancel: '取り置き：受け取り日から7日を過ぎると取り消します。用意が済んだ後の取り消しはお電話で。\n水素サロン：3時間前までこの画面から。それより後はお電話で。\n配送：発送の前ならお電話で取り消せます（ネットで払った分はSquareから返金）。',
        version: 'v1'
      },
      shopMembers: [
        { email: 'owner@example.com', name: 'オーナー', role: 'owner' },
        { email: 'fujimoto3456@gmail.com', name: '藤本さん', role: 'admin' }
      ],
      sampleData: true
    };
  }

  var SCHOOLS = [
    { id: 'kamisu2', name: '神栖第二中学校', short: '神栖二中', kind: '中', measure: true, sort: 1 },
    { id: 'kamisu4', name: '神栖第四中学校', short: '神栖四中', kind: '中', measure: true, sort: 2 },
    { id: 'ikisu', name: '息栖小学校', short: '息栖小', kind: '小', measure: false, sort: 3 },
    { id: 'fukashiba', name: '深芝小学校', short: '深芝小', kind: '小', measure: false, sort: 4 },
    { id: 'onohara', name: '大野原小学校', short: '大野原小', kind: '小', measure: false, sort: 5 },
    { id: 'onoharanishi', name: '大野原西小学校', short: '大野原西小', kind: '小', measure: false, sort: 6 }
  ];

  var TEEN = ['S', 'M', 'L', 'LL', '3L'];
  var SHOES = ['16.0', '17.0', '18.0', '19.0', '20.0', '21.0', '22.0', '23.0', '24.0'];
  var GUIDE_TEEN = 'S：身長145〜155cm／M：155〜165cm／L：165〜175cm／LL：175〜185cm／3L：185cm〜';

  /* 小学校の体操服のサイズ（お店の価格表 2026-11-01）。中は身長の目安、表示は「5S(120)」 */
  var KIDS = ['120', '130', '140', '150', '160', '165', '170', '175', '180', '185'];
  var KIDS_LABEL = { '120': '5S(120)', '130': '4S(130)', '140': '3S(140)', '150': '2S(150)', '160': 'S(160)', '165': 'M(165)', '170': 'L(170)', '175': 'LL(175)', '180': '3L(180)', '185': '4L(185)' };
  var GUIDE_KIDS = '5S(120)：身長115〜125cm／4S(130)：125〜135cm／3S(140)：135〜145cm／2S(150)：145〜155cm／S(160)：155〜162cm／M(165)：163〜167cm／L(170)：168〜172cm／LL(175)：173〜177cm／3L(180)：178〜182cm／4L(185)：183cm〜';
  /* 価格表は2サイズずつ同じ価格の6列：5S／4S・3S／2S・S／M・L／LL・3L／4L。
     LL・3L は [LL, 3L] と2つ書いた学校だけ別の価格 */
  function kidsPrices(cols) {
    var ll = Array.isArray(cols[4]) ? cols[4] : [cols[4], cols[4]];
    return { '120': cols[0], '130': cols[1], '140': cols[1], '150': cols[2], '160': cols[2], '165': cols[3], '170': cols[3], '175': ll[0], '180': ll[1], '185': cols[5] };
  }
  /* 小学校4校の本物の価格（税込み・円）。長そでと長ズボンは同じ価格 */
  var KIDS_PRICES = {
    ikisu: { long: [3700, 3900, 4100, 4300, [4600, 4900], 5100], tee: [2300, 2400, 2650, 2850, 3000, 3300], shorts: [2800, 2900, 3000, 3100, 3200, 3500] },
    fukashiba: { long: [4550, 4750, 4950, 5300, 5800, 6200], tee: [2500, 2600, 2750, 2850, 3050, 3300], shorts: [3000, 3100, 3200, 3300, 3400, 3600], note: 'アイロンネームを含んだ価格です' },
    onohara: { long: [4500, 4800, 5100, 5400, [5700, 5900], 6100], tee: [2300, 2400, 2600, 2750, 2900, 3100], shorts: [2700, 2900, 3200, 3500, 3700, 3900] },
    onoharanishi: { long: [4100, 4350, 4700, 5050, [5300, 5600], 5900], tee: [2300, 2450, 2600, 2750, 3000, 3400], shorts: [2800, 2900, 3200, 3450, 3750, 4000] }
  };

  /* 品物。小学校4校はお店の価格表どおり（2026-11-01）。中学校と反射タスキは仮の価格（priceTentative）。写真はお店からもらってから */
  function products() {
    var out = [], n = 0;
    function add(schoolId, cat, name, sizes, price, opts) {
      opts = opts || {};
      n++;
      out.push({
        id: 'P' + (n < 10 ? '0' : '') + n, schoolId: schoolId, cat: cat, name: name, sizes: sizes, price: price,
        sizePrices: opts.sizePrices || null, sizeLabels: opts.sizeLabels ? JSON.parse(JSON.stringify(opts.sizeLabels)) : null,
        priceTentative: opts.tentative !== false, needsMeasure: !!opts.measure, required: opts.required !== false,
        sizeGuide: opts.guide || '', note: opts.note || '', photo: '', visible: true, sort: n, forKind: opts.forKind || ''
      });
    }
    ['kamisu2', 'kamisu4'].forEach(function (s) {
      add(s, '制服', '学生服 上着（男子）', ['150A', '160A', '165A', '170A', '175A', '180A'], 0, { measure: true, note: '採寸してからご用意します' });
      add(s, '制服', '学生服 ズボン（男子）', ['61', '64', '67', '70', '73', '76'], 0, { measure: true, note: '採寸してからご用意します' });
      add(s, '制服', 'ブレザー（女子）', ['150A', '155A', '160A', '165A', '170A'], 0, { measure: true, note: '採寸してからご用意します' });
      add(s, '制服', 'スカート（女子）', ['W60', 'W63', 'W66', 'W69', 'W72'], 0, { measure: true, note: '採寸してからご用意します' });
      add(s, '体操服', '体操服 半袖', TEEN, 3350, { guide: GUIDE_TEEN });
      add(s, '体操服', '体操服 半ズボン', TEEN, 3300, { guide: GUIDE_TEEN });
      add(s, '体操服', 'ジャージ 上', TEEN, 6000, { guide: GUIDE_TEEN });
      add(s, '体操服', 'ジャージ 下', TEEN, 5200, { guide: GUIDE_TEEN });
    });
    ['ikisu', 'fukashiba', 'onohara', 'onoharanishi'].forEach(function (s) {
      var t = KIDS_PRICES[s];
      [['体操服 長そで', t.long], ['体操服 長ズボン', t.long], ['体操服 半そで', t.tee], ['体操服 半ズボン', t.shorts]].forEach(function (x) {
        var sp = kidsPrices(x[1]);
        add(s, '体操服', x[0], KIDS, sp['120'], { sizePrices: sp, sizeLabels: KIDS_LABEL, tentative: false, guide: GUIDE_KIDS, note: t.note || '' });
      });
      /* 体育館シューズは大野原西小だけ（価格表の 2,970円）。サイズはお店に確認中なので、並びは仮 */
      if (s === 'onoharanishi') add(s, 'シューズ', '体育館シューズ', SHOES, 2970, { tentative: false, note: '0.5cm刻みのサイズは店頭でお試しください' });
    });
    add('', 'その他', '反射タスキ', ['フリー'], 1500, { required: false, note: '通学・部活に' });
    /* 小学校の共通の品（2026-11-01 追加）。価格・サイズはお店に確認中なので仮。forKind で小学校だけに出す */
    add('', '帽子', '赤白帽子', ['フリー'], 0, { forKind: '小' });
    add('', '帽子', '黄色帽子', ['フリー'], 0, { forKind: '小' });
    add('', 'シューズ', '上履き', SHOES, 0, { forKind: '小', note: '0.5cm刻みのサイズは店頭でお試しください' });
    return out;
  }

  /* 水素サロンのメニュー。料金はデモの値（通常の料金はお店に確認中）。効果はうたわない */
  function salonMenus() {
    return [
      { id: 'M1', name: 'お試し（60分・初めての方）', mins: 60, hold: 90, price: 1500, seats: 1, firstOnly: true, kind: 'お試し', desc: '初めての方だけ。ご利用の流れをスタッフがご案内します。', visible: true, sort: 1, airregi: '水素吸入初回限定' },
      { id: 'M2', name: '30分コース', mins: 30, hold: 60, price: 2500, seats: 1, kind: '通常', desc: '完全個室で30分。', visible: true, sort: 2, airregi: '水素吸入30分' },
      { id: 'M3', name: '60分コース', mins: 60, hold: 90, price: 4000, seats: 1, kind: '通常', desc: '完全個室で、ゆったりと60分。', visible: true, sort: 3, airregi: '水素吸入60分' },
      { id: 'M4', name: '30分コース（2名同時）', mins: 30, hold: 60, price: 4000, seats: 2, kind: '2名', desc: 'ご家族やご友人と、お二人同時に。2席を使います。', visible: true, sort: 4, airregi: '水素吸入30分（2名）' },
      { id: 'M5', name: '60分コース（2名同時）', mins: 60, hold: 90, price: 7000, seats: 2, kind: '2名', desc: 'お二人同時に。2席を使います。', visible: true, sort: 5, airregi: '水素吸入60分（2名）' },
      { id: 'M6', name: '30分コース（学割）', mins: 30, hold: 60, price: 800, seats: 1, kind: '学割', desc: '学生証をご提示ください。', visible: true, sort: 6, airregi: '水素吸入30分（学割）' },
      { id: 'M7', name: '60分コース（学割）', mins: 60, hold: 90, price: 1500, seats: 1, kind: '学割', desc: '学生証をご提示ください。', visible: true, sort: 7, airregi: '水素吸入60分（学割）' }
    ];
  }

  /* 「どこで知りましたか」（初回だけ聞く） */
  var HEARD = ['Instagram', 'LINE', '学校のチラシ', 'Googleマップ', 'お店の前を通って', '知り合いから', 'そのほか'];

  return { TABLES: TABLES, settings: settings, SCHOOLS: SCHOOLS, products: products, salonMenus: salonMenus, HEARD: HEARD };
})();

;
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

;
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
    /* 台帳の設定に無い文（あとから足したお知らせ）は、最初の文を使う */
    var tpl = cf.templates[opts.template] || KS.core.model.settings().templates[opts.template] || opts.text || '';
    var text = fill(tpl, vars);
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

;
/* ココスポーツ 本番：体操服・制服（F1 取り置き／F2 入荷のお知らせ／F4 配送と事前決済）
   在庫の考え方
   - stock.qty は店にある数。取り置き（注文）を受けたら減らし、取り消したら戻す
   - かごに入れた分（holds の「押さえ中」）と、入荷のお知らせで優先している分（「優先」）は、qty から引いて「残り」を出す
   - お客様には数を出さない：あり／残りわずか（2以下）／品切れ */
KS.core.goods = (function () {
  var u = KS.core.u, c = KS.core.c, N = KS.core.notify;

  function stockId(pid, size) { return pid + '|' + size; }
  function qtyOf(ctx, pid, size) { var s = ctx.db.get('stock', stockId(pid, size)); return s ? (+s.qty || 0) : 0; }
  function liveHolds(ctx) {
    var ts = ctx.now().ts;
    return ctx.db.all('holds').filter(function (h) { return (h.status === '押さえ中' || h.status === '優先') && h.expiresAt > ts; });
  }
  /* 残り（ほかの人が取れる数）。exceptKey のかご・優先は自分の分なので引かない */
  function freeQty(ctx, pid, size, exceptKey) {
    var held = u.sum(liveHolds(ctx).filter(function (h) { return h.productId === pid && h.size === size && h.ownerKey !== exceptKey; }), function (h) { return h.qty; });
    return Math.max(0, qtyOf(ctx, pid, size) - held);
  }
  function mark(ctx, n) { return n <= 0 ? '品切れ' : (n <= c.cfg(ctx).cart.lowStock ? '残りわずか' : 'あり'); }

  /* かごの持ち主：LINEの人はお客様ID、外の人はかごのID */
  function ownerKey(ctx, cartId) { var me = c.meLine(ctx); return me ? me.id : 'cart:' + cartId; }

  /* --- C10 学校を選ぶ --- */
  function schools(ctx) {
    var me = c.meLine(ctx);
    var list = ctx.db.all('schools').filter(function (s) { return s.visible !== false; }).sort(u.by('sort'));
    return { ok: true, schools: list, lastSchoolId: me ? me.schoolId : '' };
  }

  /* --- C11 学校の品物 --- */
  function schoolItems(ctx, args) {
    var s = c.school(ctx, args.schoolId); if (!s || s.visible === false) return u.fail('学校が見つかりません。', 'notfound');
    var me = c.meLine(ctx);
    if (me && me.schoolId !== s.id) ctx.db.update('customers', me.id, { schoolId: s.id });
    var items = ctx.db.all('products').filter(function (p) { return p.visible && (p.schoolId === s.id || (p.schoolId === '' && (!p.forKind || p.forKind === s.kind))); })
      .sort(u.by('sort')).map(function (p) { return summary(ctx, p); });
    return { ok: true, school: s, items: items, measureOpen: !!c.cfg(ctx).stages.measure && s.measure, campaign: campaignFor(ctx, s.id), orderOpen: orderOpen(ctx), reserveOpen: reserveOpen(ctx, s.id) };
  }
  /* 体操服のお買い上げプレゼントの案内（設定 campaign）。有効で、その学校が対象のときだけ */
  function campaignFor(ctx, schoolId) {
    var cp = c.cfg(ctx).campaign;
    if (!cp || !cp.on || !String(cp.text || '').trim()) return null;
    if (cp.schoolIds && cp.schoolIds.length && cp.schoolIds.indexOf(schoolId) < 0) return null;
    return { title: cp.title || '', text: cp.text };
  }
  /* 取り置きを始めているか。始める前（料金表だけ）は、在庫のありなしも出さない */
  function orderOpen(ctx) { return !!c.cfg(ctx).stages.order; }
  function summary(ctx, p) {
    var open = orderOpen(ctx);
    var marks = p.sizes.map(function (z) { return open ? mark(ctx, freeQty(ctx, p.id, z)) : ''; });
    var any = marks.some(function (m) { return m !== '品切れ'; }), pr = c.priceRange(p);
    /* price は最低価格。priceFrom が true なら「2,300円〜」と出す */
    return {
      id: p.id, cat: p.cat, name: p.name, price: pr.min, priceMax: pr.max, priceFrom: pr.varies, priceTentative: !!p.priceTentative, needsMeasure: !!p.needsMeasure,
      required: p.required, photo: p.photo, note: p.note, state: p.needsMeasure ? '採寸' : !open ? '' : (any ? (marks.indexOf('あり') >= 0 ? 'あり' : '残りわずか') : '品切れ')
    };
  }

  /* --- C12 品物とサイズ --- */
  function item(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p || !p.visible) return u.fail('この品物は今は扱っていません。', 'notfound');
    var me = c.meLine(ctx), key = ownerKey(ctx, args.cartId || ''), open = orderOpen(ctx);
    var myWaits = me && open ? ctx.db.all('waits').filter(function (w) { return w.customerId === me.id && w.productId === p.id && (w.status === '待ち' || w.status === 'お知らせ済み'); }) : [];
    var sizes = p.sizes.map(function (z) {
      var mine = myWaits.filter(function (w) { return w.size === z; })[0];
      return { size: z, label: c.sizeLabel(p, z), price: c.priceOf(p, z), state: open ? mark(ctx, freeQty(ctx, p.id, z, key)) : '', waiting: !!mine, waitStatus: mine ? mine.status : '' };
    });
    var pr = c.priceRange(p);
    var rsid = p.schoolId || String(args.schoolId || '');
    return { ok: true, product: p, school: p.schoolId ? c.school(ctx, p.schoolId) : null, sizes: sizes, priceMin: pr.min, priceMax: pr.max, priceFrom: pr.varies, orderOpen: open,
      reserveOpen: reserveOpen(ctx, rsid) && reservable(ctx, p, rsid), reserveSchoolId: rsid };
  }

  /* --- C13 かご（30分だけ在庫を押さえる） --- */
  function cart(ctx, args) {
    var key = ownerKey(ctx, args.cartId || ''), ts = ctx.now().ts;
    var hs = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中'; });
    var expired = [];
    hs.forEach(function (h) { if (h.expiresAt <= ts) ctx.db.update('holds', h.id, { status: '期限切れ' }); });
    /* 期限切れになって、まだお客様に見せていない分（5分ごとの処理が先に切ることがあるため） */
    ctx.db.all('holds').forEach(function (h) {
      if (h.ownerKey === key && h.status === '期限切れ' && !h.seen && ts - h.expiresAt < 86400000) { ctx.db.update('holds', h.id, { seen: true }); expired.push(c.productLabel(ctx, h.productId, h.size)); }
    });
    var lines = hs.filter(function (h) { return h.expiresAt > ts; }).map(function (h) {
      var p = c.product(ctx, h.productId);
      return { holdId: h.id, productId: h.productId, size: h.size, qty: h.qty, name: p ? p.name : '', label: c.productLabel(ctx, h.productId, h.size), price: c.priceOf(p, h.size), priceTentative: p ? !!p.priceTentative : false, expiresAt: h.expiresAt };
    });
    var minExp = lines.length ? Math.min.apply(null, lines.map(function (l) { return l.expiresAt; })) : 0;
    return { ok: true, lines: lines, goods: u.sum(lines, function (l) { return l.price * l.qty; }), count: u.sum(lines, function (l) { return l.qty; }), expiresAt: minExp, expired: expired, now: ts };
  }
  function cartAdd(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p) return u.fail('品物が見つかりません。', 'notfound');
    if (p.needsMeasure) return u.fail('制服は採寸してからご用意します。採寸のご予約へお進みください。', 'measure');
    if (p.sizes.indexOf(args.size) < 0) return u.fail('サイズを選んでください。', 'size');
    var qty = Math.max(1, Math.min(9, +args.qty || 1)), key = ownerKey(ctx, args.cartId || ''), now = ctx.now();
    var hold = c.cfg(ctx).cart.holdMin * 60000;
    /* 入荷のお知らせで自分に優先が付いていれば、それをかごに移す */
    var pri = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '優先' && h.productId === p.id && h.size === args.size && h.expiresAt > now.ts; })[0];
    if (pri) {
      ctx.db.update('holds', pri.id, { status: '押さえ中', expiresAt: now.ts + hold, qty: Math.max(pri.qty, 1) });
      qty = Math.max(0, qty - pri.qty);
      if (!qty) return cart(ctx, args);
    }
    var free = freeQty(ctx, p.id, args.size, key) - u.sum(ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中' && h.productId === p.id && h.size === args.size && h.expiresAt > now.ts; }), function (h) { return h.qty; });
    if (free < qty) return u.fail(free > 0 ? 'このサイズは残り少なく、' + qty + '点はご用意できません。数を減らしてください。' : 'このサイズはたった今品切れになりました。入荷のお知らせに登録できます。', 'soldout', { free: free });
    var same = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中' && h.productId === p.id && h.size === args.size && h.expiresAt > now.ts; })[0];
    if (same) ctx.db.update('holds', same.id, { qty: same.qty + qty, expiresAt: now.ts + hold });
    else ctx.db.insert('holds', { id: ctx.db.nextId('H'), ownerKey: key, productId: p.id, size: args.size, qty: qty, status: '押さえ中', expiresAt: now.ts + hold, createdAt: now.ts, waitId: pri ? pri.waitId : '' });
    return cart(ctx, args);
  }
  function cartSet(ctx, args) {
    var key = ownerKey(ctx, args.cartId || ''), h = ctx.db.get('holds', args.holdId);
    if (!h || h.ownerKey !== key) return cart(ctx, args);
    var q = +args.qty || 0;
    if (q <= 0) ctx.db.update('holds', h.id, { status: '外した' });
    else if (q > h.qty) {
      var free = freeQty(ctx, h.productId, h.size, key);
      var mineOther = 0;
      if (free - mineOther < q) return u.fail('この数はご用意できません。', 'soldout');
      ctx.db.update('holds', h.id, { qty: q });
    } else ctx.db.update('holds', h.id, { qty: q });
    return cart(ctx, args);
  }

  /* --- C14 受け取りの日（営業日だけ） --- */
  function pickupDays(ctx) {
    var cf = c.cfg(ctx), today = ctx.now().date, out = [];
    for (var i = cf.pickup.fromDays; i <= cf.pickup.toDays; i++) {
      var d = u.addDays(today, i);
      out.push({ date: d, open: c.isOpen(ctx, d), why: c.isOpen(ctx, d) ? '' : (c.holidayReason(ctx, d) || '定休日') });
    }
    return out;
  }
  function checkoutInfo(ctx, args) {
    var me = c.meLine(ctx), cf = c.cfg(ctx), cr = cart(ctx, args);
    return {
      ok: true, cart: cr, days: pickupDays(ctx), ship: cf.stages.ship ? cf.ship : null, prepay: !!cf.stages.prepay,
      profile: me ? { name: me.name, kana: me.kana, phone: me.phone, email: me.email, inLine: true } : { inLine: false },
      legal: cf.legal, shop: cf.shop, keepDays: cf.pickup.keepDays, payDeadlineMin: cf.payment.deadlineMin
    };
  }
  function shipFee(ctx, methodId, count) {
    var m = c.cfg(ctx).ship.methods.filter(function (x) { return x.id === methodId; })[0];
    if (!m) return null;
    if (count > m.maxItems) return { error: 'この送り方は' + m.maxItems + '点までです。' };
    return { method: m, fee: m.fee };
  }

  /* --- 予約（すぐ予約）：在庫を押さえず、入荷のあと先着順にお渡し。開けた学校の品だけ --- */
  function reserveOpen(ctx, schoolId) {
    var cf = c.cfg(ctx);
    return !!(cf.stages.reserve && cf.reserve && (cf.reserve.schoolIds || []).indexOf(schoolId) >= 0);
  }
  /* その学校の予約で選べる品か（学校の品か、小学校共通の品。価格が決まっていて、採寸の要らないもの） */
  function reservable(ctx, p, schoolId) {
    var s = c.school(ctx, schoolId);
    if (!p || !p.visible || !s || p.needsMeasure || p.priceTentative) return false;
    return p.schoolId === s.id || (p.schoolId === '' && (!p.forKind || p.forKind === s.kind));
  }
  function preorder(ctx, args) {
    var cf = c.cfg(ctx), f = args.form || {}, me = c.meLine(ctx), now = ctx.now(), sid = String(f.schoolId || '');
    if (!reserveOpen(ctx, sid)) return u.fail('この学校のご予約は、まだ始まっていません。', 'closed');
    var want = (args.lines || []).slice(0, 30), lines = [], bad = [];
    want.forEach(function (l) {
      var p = c.product(ctx, l.productId), q = Math.max(1, Math.min(9, +l.qty || 1));
      if (!reservable(ctx, p, sid) || p.sizes.indexOf(l.size) < 0) { bad.push(p ? p.name : '（品物）'); return; }
      lines.push({ productId: p.id, size: l.size, qty: q, price: c.priceOf(p, l.size), name: p.name, label: c.productLabel(ctx, p.id, l.size), waitId: '' });
    });
    if (bad.length) return u.fail('ご予約できない品があります：' + bad.join('、') + '。選び直してください。', 'lines');
    if (!lines.length) return u.fail('品物を選んでください。', 'empty');
    var e = {};
    if (!String(f.children || '').trim()) e.children = 'お子さまのお名前を入力してください。';
    if (!String(f.name || '').trim()) e.name = '保護者のお名前を入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!me && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。確認のお知らせをお送りします。';
    if (!f.agree) e.agree = 'お渡しの時期と先着順を確かめて、チェックを入れてください。';
    if (Object.keys(e).length) return u.fail('入力を確かめてください。', 'input', { errors: e });
    var cust = c.resolveCustomer(ctx, { name: f.name, kana: f.kana, phone: f.phone, email: f.email, schoolId: sid, heardFrom: f.heardFrom }, me ? 'LINE' : (args.utm && args.utm.source) || 'Web');
    var goods = u.sum(lines, function (l) { return l.price * l.qty; });
    var o = {
      id: ctx.db.nextId('T'), token: u.token(), customerId: cust.id, lines: lines, method: '店頭', pickupDate: '', ship: null, pay: '店頭',
      payStatus: '店頭で', payRef: '', payUrl: '', payDeadline: 0, status: '受付', goods: goods, shipFee: 0, total: goods, type: '予約', schoolId: sid,
      children: String(f.children).trim(), contact: { name: String(f.name).trim(), phone: u.normPhone(f.phone), email: u.normEmail(f.email || '') },
      channel: me ? 'LINE' : 'Web', utm: args.utm || null, note: String(f.note || ''), createdAt: u.stamp(now.ts), createdDate: now.date,
      remindedDayBefore: false, noShowNotified: false, cancelReason: '', doneAt: '', legalVersion: cf.legal.version
    };
    ctx.db.insert('orders', o);
    c.audit(ctx, '予約を受付', o.id + '（' + lines.length + '品・' + (c.school(ctx, sid) || {}).short + '）');
    N.send(ctx, cust, {
      kind: '受付', template: 'preorder_received', refId: o.id, mode: 'reply', subject: '体操服のご予約を受け付けました',
      vars: { 番号: o.id, 品物: linesText(o), 合計: u.yen(goods), お渡し: cf.reserve.handText, リンク: c.link(ctx, 'my/order/' + o.token) }
    });
    return { ok: true, order: view(ctx, ctx.db.get('orders', o.id)) };
  }

  /* --- C15 最後の確認 → 注文（取り置き）を作る --- */
  function validateOrder(ctx, f, inLine) {
    var e = {};
    if (!String(f.name || '').trim()) e.name = 'お名前を入力してください。';
    if (!u.okPhone(f.phone)) e.phone = '電話番号をご確認ください（10〜11桁）。';
    if (!inLine && !u.okEmail(f.email)) e.email = 'メールアドレスをご確認ください。確認のお知らせをお送りします。';
    if (f.method === '配送') {
      if (!u.okZip(f.zip)) e.zip = '郵便番号を7桁で入力してください。';
      if (!String(f.addr || '').trim()) e.addr = '住所を入力してください。';
      if (!f.shipMethod) e.shipMethod = '送り方を選んでください。';
    } else if (!f.pickupDate) e.pickupDate = '受け取りの日を選んでください。';
    if (!f.agree) e.agree = '内容と決まりをご確認のうえ、チェックを入れてください。';
    return e;
  }
  function placeOrder(ctx, args) {
    var cf = c.cfg(ctx), f = args.form || {}, me = c.meLine(ctx), now = ctx.now();
    if (!cf.stages.order) return u.fail('ただいま準備中です。お電話でお問い合わせください。', 'closed');
    if (f.method === '配送' && !cf.stages.ship) return u.fail('配送はまだ準備中です。', 'closed');
    var errs = validateOrder(ctx, f, !!me);
    if (Object.keys(errs).length) return u.fail('入力を確かめてください。', 'input', { errors: errs });
    if (f.method !== '配送') {
      var d = pickupDays(ctx).filter(function (x) { return x.date === f.pickupDate; })[0];
      if (!d || !d.open) return u.fail('その日はお休みです。ほかの日を選んでください。', 'input', { errors: { pickupDate: 'その日はお休みです。' } });
    }
    var key = ownerKey(ctx, args.cartId || '');
    var hs = ctx.db.all('holds').filter(function (h) { return h.ownerKey === key && h.status === '押さえ中'; });
    if (!hs.length) return u.fail('かごが空です。品物を選び直してください。', 'empty');
    /* かごの期限が切れていたら、取り直せるか確かめる（同時に取られていれば C13 に戻す） */
    var lost = [];
    hs.forEach(function (h) {
      if (h.expiresAt > now.ts) return;
      if (freeQty(ctx, h.productId, h.size, key) >= h.qty) ctx.db.update('holds', h.id, { expiresAt: now.ts + cf.cart.holdMin * 60000 });
      else { ctx.db.update('holds', h.id, { status: '期限切れ' }); lost.push(c.productLabel(ctx, h.productId, h.size)); }
    });
    if (lost.length) return u.fail('確保できなかった品があります：' + lost.join('、') + '。かごを確かめてください。', 'lost', { lost: lost });
    hs = hs.filter(function (h) { return ctx.db.get('holds', h.id).status === '押さえ中'; });
    var count = u.sum(hs, function (h) { return h.qty; });
    var ship = null;
    if (f.method === '配送') {
      var sf = shipFee(ctx, f.shipMethod, count);
      if (!sf || sf.error) return u.fail(sf ? sf.error : '送り方を選んでください。', 'input', { errors: { shipMethod: sf ? sf.error : '送り方を選んでください。' } });
      ship = { methodId: sf.method.id, method: sf.method.name, fee: sf.fee, zip: u.normPhone(f.zip), addr: String(f.addr).trim(), to: String(f.shipName || f.name).trim(), tracking: '' };
    }
    var cust = c.resolveCustomer(ctx, { name: f.name, kana: f.kana, phone: f.phone, email: f.email, heardFrom: f.heardFrom, schoolId: f.schoolId }, me ? 'LINE' : (args.utm && args.utm.source) || 'Web');
    var lines = hs.map(function (h) {
      var p = c.product(ctx, h.productId);
      return { productId: h.productId, size: h.size, qty: h.qty, price: c.priceOf(p, h.size), name: p.name, label: c.productLabel(ctx, h.productId, h.size), waitId: h.waitId || '' };
    });
    var goods = u.sum(lines, function (l) { return l.price * l.qty; });
    var prepay = f.method === '配送' || (f.pay === '事前' && cf.stages.prepay);
    var o = {
      id: ctx.db.nextId('T'), token: u.token(), customerId: cust.id, lines: lines, method: f.method === '配送' ? '配送' : '店頭',
      pickupDate: f.method === '配送' ? '' : f.pickupDate, ship: ship, pay: prepay ? '事前' : '店頭',
      payStatus: prepay ? '支払い待ち' : '店頭で', payRef: '', payUrl: '', payDeadline: prepay ? now.ts + cf.payment.deadlineMin * 60000 : 0,
      status: prepay ? '支払い待ち' : '受付', goods: goods, shipFee: ship ? ship.fee : 0, total: goods + (ship ? ship.fee : 0),
      contact: { name: String(f.name).trim(), phone: u.normPhone(f.phone), email: u.normEmail(f.email || '') },
      channel: me ? 'LINE' : 'Web', utm: args.utm || null, note: String(f.note || ''), createdAt: u.stamp(now.ts), createdDate: now.date,
      remindedDayBefore: false, noShowNotified: false, cancelReason: '', doneAt: '', legalVersion: cf.legal.version
    };
    ctx.db.insert('orders', o);
    /* 在庫を減らし、かごを「注文済み」に。入荷のお知らせから来た分は「予約済み」 */
    hs.forEach(function (h) {
      var sid = stockId(h.productId, h.size), st = ctx.db.get('stock', sid);
      ctx.db.update('stock', sid, { qty: Math.max(0, (st ? +st.qty : 0) - h.qty), updatedAt: u.stamp(now.ts), updatedBy: '取り置き ' + o.id });
      ctx.db.update('holds', h.id, { status: '注文済み', orderId: o.id });
      if (h.waitId) ctx.db.update('waits', h.waitId, { status: '予約済み' });
    });
    c.audit(ctx, '取り置きを受付', o.id + '（' + lines.length + '品・' + o.method + '）');
    if (prepay) {
      var pr = ctx.out.pay.create(o, { shopName: cf.shop.name, returnUrl: c.link(ctx, 'done/order/' + o.token) });
      if (!pr || !pr.ok) {
        ctx.db.update('orders', o.id, { status: '取り消し', payStatus: '取り消し', cancelReason: '支払いの画面を作れなかった' });
        restore(ctx, o, '支払いの画面を作れなかった');
        return u.fail('支払いの画面を開けませんでした。時間をおいてもう一度、またはお電話でお願いします。', 'pay');
      }
      ctx.db.update('orders', o.id, { payRef: pr.ref, payUrl: pr.url });
      return { ok: true, order: view(ctx, ctx.db.get('orders', o.id)), payUrl: pr.url };
    }
    sendReceived(ctx, o, cust);
    return { ok: true, order: view(ctx, ctx.db.get('orders', o.id)) };
  }
  function sendReceived(ctx, o, cust) {
    N.send(ctx, cust || ctx.db.get('customers', o.customerId), {
      kind: '受付', template: 'order_received', refId: o.id, mode: 'reply', subject: '取り置きのご予約を受け付けました',
      vars: { 番号: o.id, 品物: linesText(o), 受け取り: receiveText(ctx, o), 支払い: payText(o), リンク: c.link(ctx, 'my/order/' + o.token) }
    });
  }
  function linesText(o) { return o.lines.map(function (l) { return '・' + l.label + ' ×' + l.qty; }).join('\n'); }
  function receiveText(ctx, o) { return o.method === '配送' ? '配送（' + (o.ship ? o.ship.method : '') + '）' : '店頭 ' + u.jpDate(o.pickupDate); }
  function payText(o) { return o.pay === '事前' ? (o.payStatus === '支払い済み' ? 'お支払い済み' : 'お支払い：ネットで事前') : 'お支払い：店頭'; }

  /* 在庫を戻す（取り消し・期限切れ） */
  function restore(ctx, o, why) {
    if (o.type === '予約') return;   /* 予約は在庫を押さえていない */
    var now = ctx.now();
    o.lines.forEach(function (l) {
      var sid = stockId(l.productId, l.size), st = ctx.db.get('stock', sid);
      if (st) ctx.db.update('stock', sid, { qty: (+st.qty || 0) + l.qty, updatedAt: u.stamp(now.ts), updatedBy: '戻し ' + o.id + '（' + why + '）' });
    });
  }

  /* --- C16 支払いのあと（Squareから戻ってきたとき・定期の確認） --- */
  function checkPayment(ctx, o) {
    if (!o || o.payStatus !== '支払い待ち' || !o.payRef) return o;
    var st = ctx.out.pay.status(o.payRef);
    if (st === 'paid') {
      ctx.db.update('orders', o.id, { payStatus: '支払い済み', status: '受付', paidAt: u.stamp(ctx.now().ts) });
      o = ctx.db.get('orders', o.id);
      c.audit(ctx, '支払いを確認', o.id);
      sendReceived(ctx, o);
    } else if (st === 'canceled' || (st === 'open' && ctx.now().ts > o.payDeadline)) {
      expireUnpaid(ctx, o);
      o = ctx.db.get('orders', o.id);
    }
    return o;
  }
  function expireUnpaid(ctx, o) {
    if (o.status !== '支払い待ち') return;
    ctx.db.update('orders', o.id, { status: '取り消し', payStatus: '期限切れ', cancelReason: '支払いの期限（' + c.cfg(ctx).payment.deadlineMin + '分）が過ぎた' });
    cancelPayLink(ctx, o);
    restore(ctx, o, '未払い');
    c.audit(ctx, '未払いのため取り消し', o.id);
  }
  function orderDone(ctx, args) {
    var o = ctx.db.all('orders').filter(function (x) { return x.token === args.token; })[0];
    if (!o) return u.fail('この受付は見つかりません。', 'gone');
    o = checkPayment(ctx, o);
    if (o.status === '取り消し' && o.payStatus === '期限切れ') return u.fail('お支払いの期限が切れました。もう一度かごからお進みください。', 'expired');
    return { ok: true, order: view(ctx, o) };
  }
  /* 取り消したあとに払えてしまわないよう、支払いリンクを消す */
  function cancelPayLink(ctx, o) {
    if (o.payRef && o.payStatus !== '支払い済み' && ctx.out.pay.cancel) { try { ctx.out.pay.cancel(o.payRef); } catch (e) { } }
  }
  /* 試しの形だけ：Squareの画面の代わりに、払った／やめたを決める */
  function devPay(ctx, args) {
    var o = ctx.db.all('orders').filter(function (x) { return x.token === args.token; })[0];
    if (!o) return u.fail('見つかりません。', 'gone');
    if (ctx.out.pay.devSet) ctx.out.pay.devSet(o.payRef, args.paid ? 'paid' : 'canceled');
    return orderDone(ctx, { token: o.token });
  }

  /* 取り置きの期限：受け取り日＋7日。休みの日に当たったら次の営業日まで延ばす */
  function keepUntil(ctx, o) {
    if (!o.pickupDate) return '';
    var d = u.addDays(o.pickupDate, c.cfg(ctx).pickup.keepDays);
    for (var i = 0; i < 14 && !c.isOpen(ctx, d); i++) d = u.addDays(d, 1);
    return d;
  }
  /* お客様に見せる形 */
  function view(ctx, o) {
    var cf = c.cfg(ctx);
    return {
      id: o.id, token: o.token, kind: 'order', lines: o.lines, method: o.method, pickupDate: o.pickupDate, ship: o.ship, pay: o.pay, payStatus: o.payStatus,
      payUrl: o.payStatus === '支払い待ち' ? o.payUrl : '', payDeadline: o.payDeadline, status: o.status, goods: o.goods, shipFee: o.shipFee, total: o.total,
      createdAt: o.createdAt, cancelReason: o.cancelReason, keepUntil: keepUntil(ctx, o), type: o.type || '', handText: o.type === '予約' ? c.cfg(ctx).reserve.handText : '',
      canCancel: o.status === '受付' || o.status === '支払い待ち', mustCall: o.status === '用意済み', contact: o.contact
    };
  }

  /* --- C20 入荷のお知らせの登録 --- */
  function waitAdd(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p) return u.fail('品物が見つかりません。', 'notfound');
    if (p.sizes.indexOf(args.size) < 0) return u.fail('サイズを選んでください。', 'size');
    var me = c.meLine(ctx), now = ctx.now(), cust;
    if (me) cust = me;
    else {
      if (!u.okEmail(args.email)) return u.fail('お知らせを送るメールアドレスを入力してください。', 'input', { errors: { email: 'メールアドレスをご確認ください。' } });
      cust = c.resolveCustomer(ctx, { email: args.email, name: args.name || '' }, 'Web');
    }
    var dup = ctx.db.all('waits').filter(function (w) { return w.customerId === cust.id && w.productId === p.id && w.size === args.size && (w.status === '待ち' || w.status === 'お知らせ済み'); })[0];
    if (dup) return { ok: true, wait: waitView(ctx, dup), already: true };
    var w = ctx.db.insert('waits', {
      id: ctx.db.nextId('W'), token: u.token(), customerId: cust.id, schoolId: p.schoolId, productId: p.id, size: args.size,
      createdAt: u.stamp(now.ts), createdTs: now.ts, status: '待ち', notifiedAt: '', priorityUntil: 0, channel: me ? 'LINE' : 'メール'
    });
    c.audit(ctx, '入荷のお知らせに登録', w.id + '（' + c.productLabel(ctx, p.id, args.size) + '）');
    return { ok: true, wait: waitView(ctx, w) };
  }
  function waitView(ctx, w) {
    var p = c.product(ctx, w.productId);
    return { id: w.id, token: w.token, kind: 'wait', productId: w.productId, size: w.size, label: c.productLabel(ctx, w.productId, w.size), price: c.priceOf(p, w.size), status: w.status, createdAt: w.createdAt, priorityUntil: w.priorityUntil, channel: w.channel };
  }
  function waitCancel(ctx, args) {
    var w = findOwned(ctx, 'waits', args); if (!w) return u.fail('登録が見つかりません。', 'gone');
    ctx.db.update('waits', w.id, { status: '終了', endReason: 'お客様が取り消し' });
    releasePriority(ctx, w.id);
    return { ok: true };
  }

  /* --- C21 入荷のお知らせから開く --- */
  function restockOpen(ctx, args) {
    var w = ctx.db.all('waits').filter(function (x) { return x.token === args.token; })[0];
    if (!w) return u.fail('このお知らせは見つかりません。', 'gone');
    var p = c.product(ctx, w.productId), now = ctx.now(), owner = w.customerId;
    var me = c.meLine(ctx);
    var pri = ctx.db.all('holds').filter(function (h) { return h.waitId === w.id && h.status === '優先'; })[0];
    var inTime = w.status === 'お知らせ済み' && w.priorityUntil > now.ts;
    /* LINEの外の人（メールのリンク）は、かごのIDに優先を移す */
    if (inTime && pri && !me && args.cartId) ctx.db.update('holds', pri.id, { ownerKey: 'cart:' + args.cartId });
    var key = me ? me.id : 'cart:' + (args.cartId || '');
    return {
      ok: true, wait: waitView(ctx, w), inTime: inTime, mine: !me || me.id === owner, msLeft: inTime ? w.priorityUntil - now.ts : 0,
      product: p, size: w.size, sizeLabel: c.sizeLabel(p, w.size), price: c.priceOf(p, w.size), state: mark(ctx, freeQty(ctx, w.productId, w.size, key) + (inTime && pri ? 0 : 0))
    };
  }
  function releasePriority(ctx, waitId) {
    ctx.db.all('holds').filter(function (h) { return h.waitId === waitId && h.status === '優先'; }).forEach(function (h) { ctx.db.update('holds', h.id, { status: '外した' }); });
  }

  /* 入荷したとき：待っている人に、早い順に「取れる数」だけ知らせる（S05 と 24時間の繰り上げで使う） */
  function waitingFor(ctx, pid, size) {
    return ctx.db.all('waits').filter(function (w) { return w.productId === pid && w.size === size && w.status === '待ち'; }).sort(u.by('createdTs'));
  }
  function notifyWaiters(ctx, pid, size, maxCount) {
    var cf = c.cfg(ctx), now = ctx.now(), sent = [], skipped = [];
    var list = waitingFor(ctx, pid, size);
    for (var i = 0; i < list.length && sent.length < maxCount; i++) {
      var w = list[i], cust = ctx.db.get('customers', w.customerId);
      if (!cust || (cust.lineUserId && cust.blocked && !cust.email)) { ctx.db.update('waits', w.id, { status: '終了', endReason: 'ブロック' }); skipped.push(w.id); continue; }
      var until = now.ts + cf.restock.priorityHours * 3600000;
      ctx.db.update('waits', w.id, { status: 'お知らせ済み', notifiedAt: u.stamp(now.ts), priorityUntil: until });
      ctx.db.insert('holds', { id: ctx.db.nextId('H'), ownerKey: cust.id, productId: pid, size: size, qty: 1, status: '優先', expiresAt: until, createdAt: now.ts, waitId: w.id });
      var rec = N.send(ctx, cust, {
        kind: '入荷', template: 'restock', refId: w.id, mode: 'push', subject: '入荷のお知らせ',
        vars: { 品物: c.productLabel(ctx, pid), サイズ: c.sizeLabel(c.product(ctx, pid), size), 期限: u.stamp(until).slice(5).replace('-', '/') , リンク: c.link(ctx, 'restock/' + w.token) }
      });
      if (rec.status === '未送信') { ctx.db.update('waits', w.id, { status: '待ち', notifiedAt: '', priorityUntil: 0 }); releasePriority(ctx, w.id); skipped.push(w.id); if (rec.error && rec.error.indexOf('通数') >= 0) break; continue; }
      sent.push(w.id);
    }
    return { sent: sent, skipped: skipped };
  }

  /* 持ち主の確認：LINEの人は自分の行、外の人は鍵（token）で */
  function findOwned(ctx, table, args) {
    var row = args.token ? ctx.db.all(table).filter(function (x) { return x.token === args.token; })[0] : ctx.db.get(table, args.id);
    if (!row) return null;
    if (args.token && row.token === args.token) return row;
    var me = c.meLine(ctx);
    return me && row.customerId === me.id ? row : null;
  }

  /* お客様の取り消し（C41） */
  function orderCancel(ctx, args) {
    var o = findOwned(ctx, 'orders', args); if (!o) return u.fail('この受付は見つかりません。', 'gone');
    if (o.status === '用意済み') return u.fail('お店で用意が済んでいます。取り消しはお電話でお願いします。', 'call');
    if (o.status !== '受付' && o.status !== '支払い待ち') return u.fail('この受付は取り消せません（' + o.status + '）。', 'state');
    if (o.payStatus === '支払い済み') return u.fail('お支払い済みのため、お電話でお願いします（返金の手続きをします）。', 'call');
    ctx.db.update('orders', o.id, { status: '取り消し', cancelReason: 'お客様が取り消し', payStatus: o.pay === '事前' ? '取り消し' : o.payStatus });
    cancelPayLink(ctx, o);
    restore(ctx, o, 'お客様が取り消し');
    c.audit(ctx, '取り置きを取り消し（お客様）', o.id);
    N.send(ctx, ctx.db.get('customers', o.customerId), { kind: '取り消し', template: 'order_cancelled', refId: o.id, mode: 'reply', vars: { 番号: o.id, 理由: 'ご連絡ありがとうございました。' } });
    return { ok: true, id: o.id };
  }

  return {
    stockId: stockId, qtyOf: qtyOf, freeQty: freeQty, mark: mark, liveHolds: liveHolds, schools: schools, schoolItems: schoolItems, item: item,
    cart: cart, cartAdd: cartAdd, cartSet: cartSet, checkoutInfo: checkoutInfo, pickupDays: pickupDays, placeOrder: placeOrder, orderDone: orderDone,
    devPay: devPay, checkPayment: checkPayment, expireUnpaid: expireUnpaid, view: view, waitAdd: waitAdd, waitView: waitView, waitCancel: waitCancel,
    restockOpen: restockOpen, waitingFor: waitingFor, notifyWaiters: notifyWaiters, releasePriority: releasePriority, findOwned: findOwned,
    orderCancel: orderCancel, restore: restore, preorder: preorder, reserveOpen: reserveOpen, reservable: reservable, keepUntil: keepUntil, cancelPayLink: cancelPayLink, linesText: linesText, receiveText: receiveText, sendReceived: sendReceived
  };
})();

;
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

;
/* ココスポーツ 本番：お客様の入口と「わたしの予約」（C00・C01・C40・C41・C50・C60）＋時間で動く処理 */
KS.core.mine = (function () {
  var u = KS.core.u, c = KS.core.c, G = KS.core.goods, B = KS.core.booking, N = KS.core.notify;

  /* 画面を開いたとき最初に1回。LINEの中か、店の情報、作った段階 */
  function boot(ctx) {
    var cf = c.cfg(ctx), me = c.meLine(ctx);
    return {
      ok: true, inLine: !!me, shop: cf.shop, stages: cf.stages, opening: cf.opening, reserve: { schoolIds: cf.stages.reserve ? cf.reserve.schoolIds : [], handText: cf.reserve.handText }, openDays: cf.openDays, open: cf.open, close: cf.close,
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
        var fit = b.type === '試着';
        N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '前日', template: fit ? 'fit_dayBefore' : 'measure_dayBefore', refId: b.id, mode: 'push', optional: true, subject: fit ? '明日は試着のご来店の日です' : '明日は採寸のご予約日です', vars: B.measureVars(ctx, b) });
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

;
/* ココスポーツ 本番：店の画面（S01〜S08）の裏側。お母さんのスマホで使う前提 */
KS.core.shop = (function () {
  var u = KS.core.u, c = KS.core.c, G = KS.core.goods, B = KS.core.booking, N = KS.core.notify;

  function custBrief(ctx, id) {
    var x = ctx.db.get('customers', id);
    return x ? { id: x.id, name: c.nameOf(x), phone: x.phone, email: x.email, line: !!x.lineUserId, blocked: !!x.blocked } : { id: id, name: '（不明）' };
  }
  function orderRow(ctx, o) {
    var v = G.view(ctx, o); v.customer = custBrief(ctx, o.customerId); v.channel = o.channel; v.note = o.note; v.utm = o.utm; v.payRef = o.payRef; return v;
  }
  function salonRow(ctx, b) {
    var v = B.salonView(ctx, b); v.customer = custBrief(ctx, b.customerId); v.channel = b.channel; v.seatIds = b.seatIds; v.note = b.note; v.heardFrom = b.heardFrom; return v;
  }
  function measureRow(ctx, b) { var v = B.measureView(ctx, b); v.customer = custBrief(ctx, b.customerId); return v; }

  /* S01 今日：受け取り → サロン → 発送 → 新しい取り置き → 期限が近いもの */
  function today(ctx, args) {
    var now = ctx.now(), d = (args && args.date) || now.date;
    var orders = ctx.db.all('orders');
    var pickups = orders.filter(function (o) { return o.method === '店頭' && o.pickupDate === d && (o.status === '受付' || o.status === '用意済み' || o.status === '受け取り済み'); }).map(function (o) { return orderRow(ctx, o); });
    var salon = ctx.db.all('salonBookings').filter(function (b) { return b.date === d && b.status !== '取り消し（お客様）' && b.status !== '取り消し（店）'; }).sort(u.by('start')).map(function (b) { return salonRow(ctx, b); });
    var measure = ctx.db.all('measureBookings').filter(function (b) { return b.date === d && b.status !== '取り消し'; }).sort(u.by('start')).map(function (b) { return measureRow(ctx, b); });
    var ship = orders.filter(function (o) { return o.method === '配送' && o.status === '受付' && o.payStatus === '支払い済み'; }).map(function (o) { return orderRow(ctx, o); });
    var fresh = orders.filter(function (o) { return o.status === '受付' && o.method === '店頭' && o.pickupDate !== d; }).map(function (o) { return orderRow(ctx, o); }).reverse();
    var cf = c.cfg(ctx);
    var nearing = orders.filter(function (o) { return o.method === '店頭' && (o.status === '受付' || o.status === '用意済み') && o.pickupDate && o.pickupDate < d; }).map(function (o) {
      var r = orderRow(ctx, o); r.daysLate = u.daysBetween(o.pickupDate, d); r.daysLeft = cf.pickup.keepDays - r.daysLate; return r;
    });
    var waitsNotified = ctx.db.all('waits').filter(function (w) { return w.status === 'お知らせ済み'; }).length;
    return { ok: true, date: d, open: c.isOpen(ctx, d), pickups: pickups, salon: salon, measure: measure, ship: ship, fresh: fresh, nearing: nearing, quota: N.quota(ctx), waitsNotified: waitsNotified };
  }

  /* S02 カレンダー（日・週）：サロン2席×30分、採寸の枠、ブロック、受け取り */
  function calendar(ctx, args) {
    var from = args.from || ctx.now().date, n = Math.max(1, Math.min(7, +args.days || 1)), cf = c.cfg(ctx), out = [];
    for (var i = 0; i < n; i++) {
      var d = u.addDays(from, i);
      out.push({
        date: d, open: c.isOpen(ctx, d), why: c.isOpen(ctx, d) ? '' : (c.holidayReason(ctx, d) || '定休日'),
        salon: ctx.db.all('salonBookings').filter(function (b) { return b.date === d && B.active(b); }).sort(u.by('start')).map(function (b) { return salonRow(ctx, b); }),
        blocks: ctx.db.all('salonBlocks').filter(function (b) { return b.date === d; }),
        measureSlots: ctx.db.all('measureSlots').filter(function (s) { return s.date === d; }).map(function (s) { var sc = c.school(ctx, s.schoolId); return { id: s.id, school: sc ? sc.short : '', start: s.start, end: s.end, capacity: s.capacity, used: B.slotUsed(ctx, s.id) }; }),
        pickups: ctx.db.all('orders').filter(function (o) { return o.pickupDate === d && (o.status === '受付' || o.status === '用意済み'); }).length
      });
    }
    return { ok: true, from: from, days: out, seats: cf.salon.seats, open: cf.open, close: cf.close, step: cf.salon.step, menus: B.menus(ctx, true) };
  }

  /* S03 予約を入れる・変える（電話・店頭）、席の押さえ */
  function salonCreate(ctx, args) { var f = args.form || {}; f.channel = f.channel || '電話'; return B.salonBook(ctx, { form: f, asShop: true }); }
  function salonWeekShop(ctx, args) {
    var m = B.menu(ctx, args.menuId); if (!m) return u.fail('メニューを選んでください。', 'menu');
    var d = args.date || ctx.now().date;
    return { ok: true, date: d, menu: m, slots: B.startTimes(ctx, m).map(function (t) { var s = B.slotState(ctx, d, t, m, { asShop: true, ignoreId: args.ignoreId }); return { start: t, mark: s.mark, ok: s.ok, why: s.why }; }) };
  }
  function salonSet(ctx, args) {
    var b = ctx.db.get('salonBookings', args.id); if (!b) return u.fail('予約が見つかりません。', 'gone');
    var st = args.status;
    if (st === '来店済み') { ctx.db.update('salonBookings', b.id, { status: '来店済み', visitedAt: u.stamp(ctx.now().ts) }); }
    else if (st === '無断キャンセル') ctx.db.update('salonBookings', b.id, { status: '無断キャンセル' });
    else if (st === '取り消し（店）' || st === '取り消し（お客様）') {
      ctx.db.update('salonBookings', b.id, { status: st, cancelReason: args.reason || (st === '取り消し（店）' ? '店の都合' : 'お客様から電話') });
      if (args.notify) N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '取り消し', template: 'salon_cancelled', refId: b.id, mode: 'push', vars: B.salonVars(ctx, b) });
    } else if (st === 'move') {
      var m = B.menu(ctx, b.menuId), s = B.slotState(ctx, args.date, +args.start, m, { asShop: true, ignoreId: b.id });
      if (!s.ok) return u.fail(s.why, 'slot');
      var free = B.freeSeats(ctx, args.date, +args.start, m.hold, b.id);
      ctx.db.update('salonBookings', b.id, { date: args.date, start: +args.start, end: +args.start + m.mins, holdUntil: +args.start + m.hold, seatIds: free.slice(0, m.seats), reminded: false });
      if (args.notify) N.send(ctx, ctx.db.get('customers', b.customerId), { kind: '変更', template: 'salon_changed', refId: b.id, mode: 'push', vars: B.salonVars(ctx, ctx.db.get('salonBookings', b.id)) });
    } else if (st === 'note') ctx.db.update('salonBookings', b.id, { note: String(args.note || '') });
    else return u.fail('できない操作です。', 'state');
    c.audit(ctx, 'サロンの予約：' + (st === 'move' ? '日時を変更' : st), b.id);
    return { ok: true, booking: salonRow(ctx, ctx.db.get('salonBookings', b.id)) };
  }
  /* 1件のサロン予約（取り消し済みも開ける）。記録と送ったお知らせも返す */
  function salonOne(ctx, args) {
    var b = ctx.db.get('salonBookings', args.id); if (!b) return u.fail('予約が見つかりません。', 'gone');
    return { ok: true, booking: salonRow(ctx, b), history: ctx.db.all('audit').filter(function (a) { return String(a.target).indexOf(b.id) === 0; }), notices: ctx.db.all('notices').filter(function (n) { return n.refId === b.id; }) };
  }
  function blockAdd(ctx, args) {
    var start = +args.start, end = +args.end;
    if (!args.date || !(end > start)) return u.fail('日付と時間を選んでください。', 'input');
    var b = ctx.db.insert('salonBlocks', { id: ctx.db.nextId('K'), date: args.date, start: start, end: end, seatIds: args.seatIds && args.seatIds.length ? args.seatIds : c.cfg(ctx).salon.seats.map(function (s) { return s.id; }), reason: args.reason || '店の用事' });
    c.audit(ctx, '席を押さえた', args.date + ' ' + u.hm(start) + '〜' + u.hm(end));
    return { ok: true, block: b };
  }
  function blockRemove(ctx, args) { ctx.db.remove('salonBlocks', args.id); c.audit(ctx, '席の押さえを外した', args.id); return { ok: true }; }
  function measureSet(ctx, args) {
    var b = ctx.db.get('measureBookings', args.id); if (!b) return u.fail('予約が見つかりません。', 'gone');
    ctx.db.update('measureBookings', b.id, { status: args.status, cancelReason: args.reason || '' });
    c.audit(ctx, '採寸の予約：' + args.status, b.id);
    return { ok: true };
  }

  /* S04 取り置き・注文 */
  function orders(ctx, args) {
    var f = (args && args.filter) || '進行中';
    var list = ctx.db.all('orders').filter(function (o) {
      if (f === '進行中') return o.status === '受付' || o.status === '用意済み' || o.status === '支払い待ち';
      if (f === 'すべて') return true;
      return o.status === f;
    }).map(function (o) { return orderRow(ctx, o); }).reverse();
    var counts = {};
    ctx.db.all('orders').forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });
    return { ok: true, filter: f, rows: list, counts: counts };
  }
  function order(ctx, args) {
    var o = ctx.db.get('orders', args.id); if (!o) return u.fail('見つかりません。', 'gone');
    return { ok: true, order: orderRow(ctx, o), history: ctx.db.all('audit').filter(function (a) { return String(a.target).indexOf(o.id) === 0; }), notices: ctx.db.all('notices').filter(function (n) { return n.refId === o.id; }) };
  }
  function orderSet(ctx, args) {
    var o = ctx.db.get('orders', args.id); if (!o) return u.fail('見つかりません。', 'gone');
    var st = args.status, now = ctx.now(), cust = ctx.db.get('customers', o.customerId);
    if (st === '用意済み') {
      if (o.status !== '受付') return u.fail('受付のものだけ用意済みにできます。', 'state');
      ctx.db.update('orders', o.id, { status: '用意済み' });
      /* 予約は受け取りの日を決めていないので、そろったことを知らせる */
      if (o.type === '予約') N.send(ctx, cust, { kind: '用意', template: 'preorder_ready', refId: o.id, mode: 'push', subject: 'ご予約の品のご用意ができました', vars: { 番号: o.id, 品物: G.linesText(o) } });
    }
    else if (st === '受け取り済み') ctx.db.update('orders', o.id, { status: '受け取り済み', doneAt: u.stamp(now.ts) });
    else if (st === '発送済み') {
      ctx.db.update('orders', o.id, { status: '発送済み', doneAt: u.stamp(now.ts), ship: Object.assign({}, o.ship || {}, { tracking: String(args.tracking || '') }) });
      N.send(ctx, cust, { kind: '発送', template: 'order_shipped', refId: o.id, mode: 'push', subject: '発送しました', vars: { 番号: o.id, 配送: o.ship ? o.ship.method : '', 追跡: args.tracking ? '問い合わせ番号 ' + args.tracking : '' } });
    } else if (st === '取り消し') {
      if (o.status === '取り消し' || o.status === '受け取り済み' || o.status === '発送済み') return u.fail('この注文は取り消せません。', 'state');
      ctx.db.update('orders', o.id, { status: '取り消し', cancelReason: args.reason || '店で取り消し', payStatus: o.payStatus === '支払い済み' ? '返金待ち' : o.payStatus });
      G.cancelPayLink(ctx, o);
      G.restore(ctx, o, '店で取り消し');
      if (args.notify) N.send(ctx, cust, { kind: '取り消し', template: 'order_cancelled', refId: o.id, mode: 'push', vars: { 番号: o.id, 理由: args.reason || '' } });
    } else if (st === '返金済み') {
      /* 台帳だけ「返金済み」にしないよう、Squareで返金が済んだことを確かめてから記録する（返金そのものはSquareの画面で行う） */
      if (o.payStatus !== '返金待ち') return u.fail('返金待ちの注文だけ返金済みにできます。', 'state');
      var rs = o.payRef && ctx.out.pay.refundStatus ? ctx.out.pay.refundStatus(o.payRef, o.total) : 'unknown';
      if (rs !== 'refunded') return u.fail(rs === 'pending' ? 'Squareで返金の手続き中です。済んでからもう一度押してください。' : rs === 'partial' ? 'Squareでの返金が一部だけです。全額を返金してから押してください。' : 'Squareで返金が済んだことを確かめられませんでした。先にSquareの画面で返金してください。', 'refund');
      ctx.db.update('orders', o.id, { payStatus: '返金済み', refundedAt: u.stamp(ctx.now().ts) });
    }
    else if (st === 'note') ctx.db.update('orders', o.id, { note: String(args.note || '') });
    else if (st === 'pickupDate') ctx.db.update('orders', o.id, { pickupDate: args.date, remindedDayBefore: false, noShowNotified: false });
    else return u.fail('できない操作です。', 'state');
    c.audit(ctx, '取り置き：' + st, o.id);
    return { ok: true, order: orderRow(ctx, ctx.db.get('orders', o.id)) };
  }

  /* S05 在庫と入荷 */
  function stock(ctx, args) {
    var sid = args && args.schoolId;
    var ps = ctx.db.all('products').filter(function (p) { return !p.needsMeasure && (!sid || p.schoolId === sid || (sid === 'common' && !p.schoolId)); }).sort(u.by('sort'));
    var rows = ps.map(function (p) {
      return {
        product: p, school: p.schoolId ? (c.school(ctx, p.schoolId) || {}).short : '共通', price: c.priceRange(p),
        sizes: p.sizes.map(function (z) {
          var held = u.sum(G.liveHolds(ctx).filter(function (h) { return h.productId === p.id && h.size === z; }), function (h) { return h.qty; });
          return { size: z, label: c.sizeLabel(p, z), price: c.priceOf(p, z), qty: G.qtyOf(ctx, p.id, z), held: held, free: G.freeQty(ctx, p.id, z), waiting: G.waitingFor(ctx, p.id, z).length, mark: G.mark(ctx, G.freeQty(ctx, p.id, z)) };
        })
      };
    });
    return { ok: true, rows: rows, schools: ctx.db.all('schools').sort(u.by('sort')), quota: N.quota(ctx) };
  }
  /* 数を直す（棚卸し）。お知らせは送らない */
  function stockSet(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p || p.sizes.indexOf(args.size) < 0) return u.fail('品物とサイズを選んでください。', 'input');
    var q = Math.max(0, Math.floor(+args.qty || 0)), sid = G.stockId(p.id, args.size), now = ctx.now();
    var row = { qty: q, updatedAt: u.stamp(now.ts), updatedBy: c.memberName(ctx, ctx.user.shopEmail || '') + '（数を直した）' };
    if (ctx.db.get('stock', sid)) ctx.db.update('stock', sid, row); else { row.id = sid; row.productId = p.id; row.size = args.size; ctx.db.insert('stock', row); }
    c.audit(ctx, '在庫の数を直した', c.productLabel(ctx, p.id, args.size) + ' → ' + q);
    return { ok: true };
  }
  /* 入荷を入れる前の確認：「待っている人 ○人／今回知らせる ○人／今月の残り通数 ○通」 */
  function restockPreview(ctx, args) {
    var p = c.product(ctx, args.productId); if (!p) return u.fail('品物を選んでください。', 'input');
    var add = Math.max(0, Math.floor(+args.qty || 0));
    var free = G.freeQty(ctx, p.id, args.size) + add;
    var waiting = G.waitingFor(ctx, p.id, args.size);
    var lineCount = waiting.slice(0, free).filter(function (w) { var x = ctx.db.get('customers', w.customerId); return x && x.lineUserId && !x.blocked; }).length;
    var notify = Math.min(free, waiting.length);
    return { ok: true, label: c.productLabel(ctx, p.id, args.size), add: add, freeAfter: free, waiting: waiting.length, willNotify: notify, lineCount: lineCount, mailCount: notify - lineCount, quota: N.quota(ctx) };
  }
  function restockSend(ctx, args) {
    var pv = restockPreview(ctx, args); if (!pv.ok) return pv;
    var p = c.product(ctx, args.productId), sid = G.stockId(p.id, args.size), now = ctx.now(), st = ctx.db.get('stock', sid);
    if (pv.add > 0) {
      var row = { qty: (st ? +st.qty : 0) + pv.add, updatedAt: u.stamp(now.ts), updatedBy: c.memberName(ctx, ctx.user.shopEmail || '') + '（入荷 +' + pv.add + '）' };
      if (st) ctx.db.update('stock', sid, row); else { row.id = sid; row.productId = p.id; row.size = args.size; ctx.db.insert('stock', row); }
    }
    var r = args.notify === false ? { sent: [], skipped: [] } : G.notifyWaiters(ctx, p.id, args.size, pv.freeAfter);
    c.audit(ctx, '入荷を入れた', pv.label + ' +' + pv.add + '（お知らせ ' + r.sent.length + '人）');
    return { ok: true, added: pv.add, sent: r.sent.length, skipped: r.skipped.length, quota: N.quota(ctx) };
  }
  function waits(ctx, args) {
    var list = ctx.db.all('waits').filter(function (w) { return !args || !args.productId || w.productId === args.productId; }).map(function (w) {
      var v = G.waitView(ctx, w); v.customer = custBrief(ctx, w.customerId); v.notifiedAt = w.notifiedAt; v.endReason = w.endReason || ''; return v;
    }).reverse();
    return { ok: true, rows: list };
  }

  /* S06 お客様台帳 */
  function customers(ctx, args) {
    var q = String((args && args.q) || '').trim(), qp = u.normPhone(q), qk = u.normKana(q);
    var all = ctx.db.all('customers').filter(function (x) { return !x.mergedInto; });
    var list = all.filter(function (x) {
      if (!q) return true;
      return (x.name && x.name.indexOf(q) >= 0) || (x.lineName && x.lineName.indexOf(q) >= 0) || (qk && x.kana && x.kana.indexOf(qk) >= 0) || (qp.length >= 3 && x.phone && x.phone.indexOf(qp) >= 0) || (x.email && x.email.indexOf(q.toLowerCase()) >= 0);
    }).map(function (x) {
      var o = ctx.db.all('orders').filter(function (r) { return r.customerId === x.id; });
      var s = ctx.db.all('salonBookings').filter(function (r) { return r.customerId === x.id; });
      var last = [].concat(o.map(function (r) { return r.createdDate; }), s.map(function (r) { return r.date; })).sort().pop() || '';
      return { id: x.id, name: c.nameOf(x), kana: x.kana, phone: x.phone, email: x.email, line: !!x.lineUserId, blocked: !!x.blocked, school: x.schoolId ? (c.school(ctx, x.schoolId) || {}).short : '', firstSource: x.firstSource, heardFrom: x.heardFrom, orders: o.length, salon: s.filter(function (r) { return r.status === '来店済み'; }).length, last: last, createdAt: x.createdAt, memo: x.memo };
    }).sort(function (a, b) { return a.last < b.last ? 1 : -1; });
    return { ok: true, rows: list.slice(0, 300), total: all.length };
  }
  function customer(ctx, args) {
    var x = ctx.db.get('customers', args.id); if (!x) return u.fail('見つかりません。', 'gone');
    var mine = function (t) { return ctx.db.all(t).filter(function (r) { return r.customerId === x.id; }); };
    return {
      ok: true, customer: x,
      orders: mine('orders').map(function (o) { return orderRow(ctx, o); }).reverse(),
      salon: mine('salonBookings').map(function (b) { return salonRow(ctx, b); }).reverse(),
      measure: mine('measureBookings').map(function (b) { return measureRow(ctx, b); }).reverse(),
      waits: mine('waits').map(function (w) { return G.waitView(ctx, w); }).reverse(),
      notices: mine('notices').slice(-30).reverse(), reviews: mine('reviews').reverse()
    };
  }
  function customerSet(ctx, args) {
    var x = ctx.db.get('customers', args.id); if (!x) return u.fail('見つかりません。', 'gone');
    var p = {};
    ['name', 'memo'].forEach(function (k) { if (args[k] != null) p[k] = String(args[k]); });
    if (args.phone != null) p.phone = u.normPhone(args.phone);
    if (args.kana != null) p.kana = u.normKana(args.kana);
    if (args.mergeInto) {
      var to = ctx.db.get('customers', args.mergeInto); if (!to || to.id === x.id) return u.fail('まとめる先が見つかりません。', 'input');
      ['orders', 'salonBookings', 'measureBookings', 'waits', 'notices', 'reviews'].forEach(function (t) { ctx.db.all(t).filter(function (r) { return r.customerId === x.id; }).forEach(function (r) { ctx.db.update(t, r.id, { customerId: to.id }); }); });
      if (x.lineUserId && !to.lineUserId) ctx.db.update('customers', to.id, { lineUserId: x.lineUserId, lineName: x.lineName });
      p.mergedInto = to.id; p.lineUserId = '';
    }
    ctx.db.update('customers', x.id, p);
    c.audit(ctx, args.mergeInto ? '同じ方としてまとめた' : 'お客様の情報を直した', x.id + (args.mergeInto ? ' → ' + args.mergeInto : ''));
    return { ok: true };
  }

  /* S07 お知らせの記録 */
  function notices(ctx, args) { return N.log(ctx, args); }

  /* S08 設定 */
  function settingsGet(ctx) {
    var cf = c.cfg(ctx);
    return {
      ok: true, cfg: cf, schools: ctx.db.all('schools').sort(u.by('sort')), products: ctx.db.all('products').sort(u.by('sort')),
      menus: B.menus(ctx, true), holidays: ctx.db.all('holidays').sort(u.by('date')),
      measureSlots: ctx.db.all('measureSlots').sort(u.by('date')).map(function (s) { var r = u.clone(s); r.used = B.slotUsed(ctx, s.id); return r; }),
      role: ctx.user.role
    };
  }
  var CFG_LABEL = { shop: '店の情報', openDays: '営業日', open: '開店の時刻', close: '閉店の時刻', stages: 'お客様に見せるもの', cart: 'かごの決まり', pickup: '受け取りの決まり', restock: '入荷のお知らせの決まり', payment: '支払いの決まり', ship: '送り方と送料', salon: 'サロンの決まり', line: 'LINEの通数の決まり', voice: '声の決まり', campaign: 'お買い上げプレゼントの案内', templates: 'お知らせの文', legal: '決まり（特商法・プライバシー・キャンセル）', shopMembers: '店の人の名簿', sampleData: '見本のデータ' };
  var TABLE_LABEL = { schools: '学校', products: '品物', salonMenus: 'サロンのメニュー', holidays: '臨時休業', measureSlots: '採寸の枠' };
  var CFG_KEYS = ['shop', 'openDays', 'open', 'close', 'stages', 'cart', 'pickup', 'restock', 'payment', 'ship', 'salon', 'line', 'voice', 'campaign', 'templates', 'legal', 'shopMembers', 'sampleData'];
  function settingsSave(ctx, args) {
    var k = args.key;
    if (CFG_KEYS.indexOf(k) < 0) return u.fail('変えられない項目です。', 'input');
    if (k === 'shopMembers' && ctx.user.role !== 'admin' && ctx.user.role !== 'owner') return u.fail('この項目は変えられません。', 'auth');
    c.setCfg(ctx, k, args.value);
    c.audit(ctx, '設定を変えた', CFG_LABEL[k] || k);
    return { ok: true };
  }
  /* 「120:4500, 130:4800」を {120: 4500, 130: 4800} にする。空なら null。num は値を数にする */
  function sizeMap(v, num) {
    if (v === undefined || v === null || v === '') return { map: null };
    if (typeof v === 'object') v = Object.keys(v).map(function (k) { return k + ':' + v[k]; }).join(',');
    var out = {}, bad = [];
    String(v).split(/[、,，\n]+/).forEach(function (x) {
      x = x.trim(); if (!x) return;
      var m = /^([^:：]+)[:：](.+)$/.exec(x);
      if (!m) { bad.push(x); return; }
      var k = m[1].trim(), val = m[2].trim();
      if (num) { val = +String(val).replace(/[円,，\s]/g, ''); if (!(val > 0)) { bad.push(x); return; } }
      out[k] = val;
    });
    if (bad.length) return { error: (num ? 'サイズごとの価格' : 'サイズの表示名') + 'の書き方を確かめてください（「120:4500, 130:4800」のように）：' + bad.join('、') };
    return { map: Object.keys(out).length ? out : null };
  }
  /* 表の1行を足す・直す・消す（学校・品物・メニュー・休み・採寸の枠） */
  var EDIT = { schools: 'S', products: 'P', salonMenus: 'M', holidays: '', measureSlots: 'J' };
  function rowSave(ctx, args) {
    var t = args.table; if (!(t in EDIT)) return u.fail('変えられない表です。', 'input');
    var r = args.row || {}, key = KS.core.model.TABLES[t];
    if (t === 'products') {
      if (!String(r.name || '').trim()) return u.fail('品名を入れてください。', 'input');
      if (typeof r.sizes === 'string') r.sizes = r.sizes.split(/[、,\s]+/).filter(Boolean);
      r.price = +r.price || 0;
      /* サイズごとの価格・表示名：「120:4500, 130:4800」の1行でも、{サイズ: 値} でも受け取る */
      var sp = sizeMap(r.sizePrices, true), sl = sizeMap(r.sizeLabels, false);
      if (sp.error || sl.error) return u.fail(sp.error || sl.error, 'input');
      var sizes = r.sizes || (r.id && ctx.db.get('products', r.id) || {}).sizes || [];
      var stray = Object.keys(sp.map || {}).concat(Object.keys(sl.map || {})).filter(function (z) { return sizes.indexOf(z) < 0; });
      if (stray.length) return u.fail('サイズの一覧に無いサイズがあります：' + stray.join('、') + '。サイズの欄に足すか、書き方を直してください。', 'input');
      if ('sizePrices' in r) r.sizePrices = sp.map;
      if ('sizeLabels' in r) r.sizeLabels = sl.map;
      /* 価格の欄が空なら、サイズの価格のいちばん安いものを入れておく（サイズの価格が無いサイズに使う） */
      if (!r.price && sp.map) r.price = Math.min.apply(null, Object.keys(sp.map).map(function (z) { return sp.map[z]; }));
    }
    if (t === 'measureSlots') { r.start = +r.start; r.end = +r.end; r.capacity = Math.max(1, +r.capacity || 1); if (!r.schoolId || !r.date) return u.fail('学校と日付を選んでください。', 'input'); }
    if (t === 'salonMenus') { r.mins = +r.mins; r.hold = +r.hold || (+r.mins + 30); r.price = +r.price || 0; r.seats = +r.seats || 1; }
    if (r[key] && ctx.db.get(t, r[key])) ctx.db.update(t, r[key], r);
    else {
      if (!r[key]) r[key] = t === 'holidays' ? r.date : ctx.db.nextId(EDIT[t]);
      if (t === 'products') { r.visible = r.visible !== false; r.sort = r.sort || ctx.db.all('products').length + 1; r.required = r.required !== false; }
      ctx.db.insert(t, r);
    }
    c.audit(ctx, TABLE_LABEL[t] + 'を直した', r[key] + (r.name ? '（' + r.name + '）' : ''));
    return { ok: true, row: ctx.db.get(t, r[key]) };
  }
  function rowRemove(ctx, args) {
    var t = args.table; if (!(t in EDIT)) return u.fail('変えられない表です。', 'input');
    if (t === 'measureSlots' && B.slotUsed(ctx, args.key) > 0) return u.fail('予約が入っている枠は消せません。先に予約を取り消してください。', 'state');
    if (t === 'products' || t === 'schools' || t === 'salonMenus') { ctx.db.update(t, args.key, { visible: false }); c.audit(ctx, TABLE_LABEL[t] + 'の表示をやめた', args.key); return { ok: true, hidden: true }; }
    ctx.db.remove(t, args.key);
    c.audit(ctx, TABLE_LABEL[t] + 'を消した', args.key);
    return { ok: true };
  }
  function auditLog(ctx) { return { ok: true, rows: ctx.db.all('audit').slice(-300).reverse() }; }

  return {
    today: today, calendar: calendar, salonCreate: salonCreate, salonWeekShop: salonWeekShop, salonSet: salonSet, salonOne: salonOne, blockAdd: blockAdd, blockRemove: blockRemove,
    measureSet: measureSet, orders: orders, order: order, orderSet: orderSet, stock: stock, stockSet: stockSet, restockPreview: restockPreview, restockSend: restockSend,
    waits: waits, customers: customers, customer: customer, customerSet: customerSet, notices: notices, settingsGet: settingsGet, settingsSave: settingsSave,
    rowSave: rowSave, rowRemove: rowRemove, auditLog: auditLog
  };
})();

;
/* ココスポーツ 本番：運営ボード（B01〜B07）の数字。オーナー・娘さん・本人が見る
   B01 概要／B02 集客／B03 予約／B04 売上／B05 お客様／B06 声／B07 今週の3つの数字
   売上は「予約と取り置きから見込める額」。実際の会計はAirレジ（つなぎは別の段階） */
KS.core.board = (function () {
  var u = KS.core.u, c = KS.core.c, N = KS.core.notify;

  function months(ctx, n) {
    var d = ctx.now().date, out = [], y = +d.slice(0, 4), m = +d.slice(5, 7);
    for (var i = n - 1; i >= 0; i--) { var mm = m - i, yy = y; while (mm <= 0) { mm += 12; yy--; } out.push(yy + '-' + u.pad(mm)); }
    return out;
  }
  function inMonth(s, m) { return String(s || '').slice(0, 7) === m; }

  function data(ctx, args) {
    var M = months(ctx, 6), now = ctx.now(), today = now.date;
    var cs = ctx.db.all('customers').filter(function (x) { return !x.mergedInto; });
    var orders = ctx.db.all('orders'), salon = ctx.db.all('salonBookings'), measure = ctx.db.all('measureBookings'), waits = ctx.db.all('waits'), reviews = ctx.db.all('reviews');
    var okOrder = function (o) { return o.status !== '取り消し' && o.status !== '支払い待ち'; };

    /* B02 集客：LINEの友だち（このしくみで分かった人）・学校ごと・どこで知ったか */
    var lineFriends = cs.filter(function (x) { return x.lineUserId && !x.blocked; }).length;
    var blocked = cs.filter(function (x) { return x.lineUserId && x.blocked; }).length;
    var bySchool = ctx.db.all('schools').sort(u.by('sort')).map(function (s) {
      return { school: s.short, people: cs.filter(function (x) { return x.schoolId === s.id; }).length, orders: orders.filter(function (o) { return okOrder(o) && o.lines.some(function (l) { var p = c.product(ctx, l.productId); return p && p.schoolId === s.id; }); }).length, waits: waits.filter(function (w) { return w.schoolId === s.id; }).length };
    });
    var heard = {};
    cs.forEach(function (x) { var k = x.heardFrom || x.firstSource || '不明'; heard[k] = (heard[k] || 0) + 1; });
    var newByMonth = M.map(function (m) { return [m.slice(5) + '月', cs.filter(function (x) { return inMonth(x.createdAt, m); }).length]; });

    /* B03 予約：サロン（月別・メニュー別・取り消し率）、取り置き、採寸、入荷のお知らせ→予約率 */
    var salonByMonth = M.map(function (m) { return [m.slice(5) + '月', salon.filter(function (b) { return inMonth(b.date, m) && (b.status === '予約' || b.status === '来店済み'); }).length]; });
    var menuCount = {};
    salon.forEach(function (b) { if (b.status === '予約' || b.status === '来店済み') menuCount[b.menuName] = (menuCount[b.menuName] || 0) + 1; });
    var salonAll = salon.length, salonCancel = salon.filter(function (b) { return String(b.status).indexOf('取り消し') === 0 || b.status === '無断キャンセル'; }).length;
    var notified = waits.filter(function (w) { return w.status === 'お知らせ済み' || w.status === '予約済み' || (w.status === '終了' && w.notifiedAt); }).length;
    var converted = waits.filter(function (w) { return w.status === '予約済み'; }).length;
    var ordersByMonth = M.map(function (m) { return [m.slice(5) + '月', orders.filter(function (o) { return okOrder(o) && inMonth(o.createdDate, m); }).length]; });
    var channel = { LINE: 0, Web: 0, 電話: 0, 店頭: 0 };
    orders.filter(okOrder).forEach(function (o) { channel[o.channel] = (channel[o.channel] || 0) + 1; });
    salon.forEach(function (b) { if (b.status === '予約' || b.status === '来店済み') channel[b.channel] = (channel[b.channel] || 0) + 1; });

    /* B04 売上（見込み） */
    var salesByMonth = M.map(function (m) {
      var g = u.sum(orders.filter(function (o) { return okOrder(o) && inMonth(o.createdDate, m); }), function (o) { return o.total; });
      var s = u.sum(salon.filter(function (b) { return inMonth(b.date, m) && b.status === '来店済み'; }), function (b) { return b.price; });
      return { month: m, goods: g, salon: s };
    });
    var prepaid = u.sum(orders.filter(function (o) { return o.payStatus === '支払い済み'; }), function (o) { return o.total; });

    /* B05 お客様：新しい方・2回目以上 */
    var visits = {};
    salon.forEach(function (b) { if (b.status === '来店済み') visits[b.customerId] = (visits[b.customerId] || 0) + 1; });
    var repeaters = Object.keys(visits).filter(function (k) { return visits[k] >= 2; }).length;
    var visitors = Object.keys(visits).length;

    /* B06 声 */
    var avg = reviews.length ? Math.round(u.sum(reviews, function (r) { return r.stars; }) / reviews.length * 10) / 10 : 0;

    /* B07 今週の3つの数字 */
    var wk = u.addDays(today, -6);
    var thisWeek = function (s) { return s && String(s).slice(0, 10) >= wk && String(s).slice(0, 10) <= today; };
    var three = [
      { name: '新しく友だちになった方', value: cs.filter(function (x) { return x.lineUserId && thisWeek(x.createdAt); }).length, unit: '人', note: 'このしくみを開いた方の数（公式LINEの管理画面の友だち数とは違う）' },
      { name: '取り置き・予約の受付', value: orders.filter(function (o) { return okOrder(o) && thisWeek(o.createdDate); }).length + salon.filter(function (b) { return thisWeek(b.createdDate); }).length + measure.filter(function (b) { return thisWeek(b.createdAt); }).length, unit: '件', note: '取り置き・サロン・採寸の合計' },
      { name: '入荷のお知らせから取り置き', value: converted, unit: '件', note: 'お知らせした ' + notified + ' 件のうち' }
    ];

    var upcomingSalon = salon.filter(function (b) { return b.status === '予約' && b.date >= today; }).length;
    var openOrders = orders.filter(function (o) { return o.status === '受付' || o.status === '用意済み'; }).length;
    return {
      ok: true, months: M, today: today,
      summary: { customers: cs.length, lineFriends: lineFriends, blocked: blocked, upcomingSalon: upcomingSalon, openOrders: openOrders, waiting: waits.filter(function (w) { return w.status === '待ち'; }).length, reviews: reviews.length, avgStars: avg, quota: N.quota(ctx) },
      reach: { bySchool: bySchool, heard: Object.keys(heard).map(function (k) { return [k, heard[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), newByMonth: newByMonth },
      bookings: { salonByMonth: salonByMonth, menus: Object.keys(menuCount).map(function (k) { return [k, menuCount[k]]; }).sort(function (a, b) { return b[1] - a[1]; }), salonCancelRate: salonAll ?Math.round(salonCancel / salonAll * 1000) / 10 : 0, ordersByMonth: ordersByMonth, measure: measure.filter(function (b) { return b.status === '予約'; }).length, restock: { notified: notified, converted: converted }, channel: Object.keys(channel).map(function (k) { return [k, channel[k]]; }) },
      sales: { byMonth: salesByMonth, prepaid: prepaid },
      people: { visitors: visitors, repeaters: repeaters, repeatRate: visitors ? Math.round(repeaters / visitors * 1000) / 10 : 0, newByMonth: newByMonth },
      voice: { count: reviews.length, avg: avg, stars: [5, 4, 3, 2, 1].map(function (s) { return [s + '点', reviews.filter(function (r) { return r.stars === s; }).length]; }), latest: reviews.slice(-10).reverse() },
      three: three
    };
  }

  return { data: data };
})();

;
/* ココスポーツ 本番：画面からの呼び出しの窓口（ブラウザの試しの形でも、Apps Script でも同じ表を使う）
   role: 'public' はだれでも（お客様）。'shop' は店の人（店のGoogleアカウントで入った人）。'admin' は本人とオーナー
   write: true のものは、Apps Script ではロックの中で動かす（二重予約・在庫の取り合いを防ぐ）
   stage があるものは、設定の stages でその段階を出していないとき、お客様の画面からは受け付けない */
KS.core.api = (function () {
  var u = KS.core.u, G = KS.core.goods, B = KS.core.booking, Mi = KS.core.mine, S = KS.core.shop, Bd = KS.core.board;

  var TABLE = {
    /* お客様 */
    boot: { fn: Mi.boot, role: 'public' },
    schools: { fn: G.schools, role: 'public' },
    schoolItems: { fn: G.schoolItems, role: 'public', write: true },
    item: { fn: G.item, role: 'public' },
    cart: { fn: G.cart, role: 'public', write: true },
    cartAdd: { fn: G.cartAdd, role: 'public', write: true, stage: 'order' },
    cartSet: { fn: G.cartSet, role: 'public', write: true, stage: 'order' },
    checkoutInfo: { fn: G.checkoutInfo, role: 'public', write: true, stage: 'order' },
    placeOrder: { fn: G.placeOrder, role: 'public', write: true, stage: 'order' },
    preorder: { fn: G.preorder, role: 'public', write: true, stage: 'reserve' },
    orderDone: { fn: G.orderDone, role: 'public', write: true },
    devPay: { fn: G.devPay, role: 'public', write: true, devOnly: true },
    waitAdd: { fn: G.waitAdd, role: 'public', write: true, stage: 'order' },
    restockOpen: { fn: G.restockOpen, role: 'public', write: true, stage: 'order' },
    measureSchools: { fn: B.measureSchools, role: 'public' },
    measureSlots: { fn: B.measureSlots, role: 'public' },
    measureBook: { fn: B.measureBook, role: 'public', write: true },   /* 採寸は stages.measure、試着は予約を開けた学校か、を中で見る */
    salonMenus: { fn: B.salonMenus, role: 'public' },
    salonWeek: { fn: B.salonWeek, role: 'public' },
    salonForm: { fn: B.salonForm, role: 'public' },
    salonBook: { fn: B.salonBook, role: 'public', write: true, stage: 'salon' },
    salonMove: { fn: B.salonMove, role: 'public', write: true, stage: 'salon' },
    myList: { fn: Mi.myList, role: 'public' },
    detail: { fn: Mi.detail, role: 'public', write: true },
    cancel: { fn: Mi.cancel, role: 'public', write: true },
    voice: { fn: Mi.voice, role: 'public', write: true, stage: 'voice' },
    /* 店 */
    shopToday: { fn: S.today, role: 'shop' },
    shopCalendar: { fn: S.calendar, role: 'shop' },
    shopSalonSlots: { fn: S.salonWeekShop, role: 'shop' },
    shopSalonCreate: { fn: S.salonCreate, role: 'shop', write: true },
    shopSalon: { fn: S.salonOne, role: 'shop' },
    shopSalonSet: { fn: S.salonSet, role: 'shop', write: true },
    shopBlockAdd: { fn: S.blockAdd, role: 'shop', write: true },
    shopBlockRemove: { fn: S.blockRemove, role: 'shop', write: true },
    shopMeasureSet: { fn: S.measureSet, role: 'shop', write: true },
    shopOrders: { fn: S.orders, role: 'shop' },
    shopOrder: { fn: S.order, role: 'shop' },
    shopOrderSet: { fn: S.orderSet, role: 'shop', write: true },
    shopStock: { fn: S.stock, role: 'shop' },
    shopStockSet: { fn: S.stockSet, role: 'shop', write: true },
    shopRestockPreview: { fn: S.restockPreview, role: 'shop' },
    shopRestockSend: { fn: S.restockSend, role: 'shop', write: true },
    shopWaits: { fn: S.waits, role: 'shop' },
    shopCustomers: { fn: S.customers, role: 'shop' },
    shopCustomer: { fn: S.customer, role: 'shop' },
    shopCustomerSet: { fn: S.customerSet, role: 'shop', write: true },
    shopNotices: { fn: S.notices, role: 'shop' },
    shopSettings: { fn: S.settingsGet, role: 'shop' },
    shopSettingsSave: { fn: S.settingsSave, role: 'shop', write: true },
    shopRowSave: { fn: S.rowSave, role: 'shop', write: true },
    shopRowRemove: { fn: S.rowRemove, role: 'shop', write: true },
    shopAudit: { fn: S.auditLog, role: 'shop' },
    board: { fn: Bd.data, role: 'shop' },
    runJobs: { fn: Mi.runJobs, role: 'admin', write: true }
  };

  /* ctx.user.role を見て通す。opts.dev が true のときだけ devOnly を通す */
  function handle(ctx, name, args, opts) {
    var e = TABLE[name];
    if (!e) return u.fail('できない操作です（' + name + '）。', 'unknown');
    if (e.devOnly && !(opts && opts.dev)) return u.fail('試しの形だけの操作です。', 'unknown');
    var role = (ctx.user && ctx.user.role) || '';
    if (e.role === 'shop' && !role) return u.fail('店のGoogleアカウントで入ってください。', 'auth');
    if (e.role === 'admin' && role !== 'admin' && role !== 'owner' && !(ctx.user && ctx.user.system)) return u.fail('この操作はできません。', 'auth');
    if (e.stage) {
      var cf = KS.core.c.cfg(ctx);
      if (!cf.stages[e.stage]) return u.fail(e.stage === 'order' ? cf.opening.order : cf.opening.soon, 'closed');
    }
    try {
      var run = function () { return e.fn(ctx, args || {}); };
      return e.write && ctx.lock ? ctx.lock(run) : run();
    } catch (err) {
      return u.fail('うまくいきませんでした。時間をおいてもう一度お試しください。', 'error', { detail: String(err && err.stack || err) });
    }
  }
  /* 店のGoogleアカウントのメールから役割を決める */
  function roleOf(ctx, email) {
    if (!email) return '';
    var m = KS.core.c.cfg(ctx).shopMembers.filter(function (x) { return String(x.email).toLowerCase() === String(email).toLowerCase(); })[0];
    return m ? (m.role || 'staff') : '';
  }

  return { TABLE: TABLE, handle: handle, roleOf: roleOf };
})();

;
/* ココスポーツ 本番：最初に入れる行
   - initial(false) …… 本番の最初（学校・仮の品物・在庫0・メニュー）。お客様のデータは入れない
   - initial(true)  …… 試しの形（見本のお客様・予約・取り置き・入荷待ち・声を足す。名前はすべて架空） */
KS.core.seed = (function () {
  var u = KS.core.u, M = KS.core.model;

  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function initial(withSamples, nowTs) {
    var T = {}, seq = {};
    Object.keys(M.TABLES).forEach(function (k) { T[k] = []; });
    function id(p) { seq[p] = (seq[p] || 0) + 1; return idOf(p, seq[p], nowTs); }
    T.schools = M.SCHOOLS.map(function (s) { return u.clone(s); });
    T.products = M.products();
    T.salonMenus = M.salonMenus();
    var r = rng(20261101);
    T.products.forEach(function (p) {
      if (p.needsMeasure) return;
      p.sizes.forEach(function (z, i) {
        var q = withSamples ? Math.max(0, Math.round(r() * 6) - (i === p.sizes.length - 1 ? 3 : 0)) : 0;
        T.stock.push({ id: p.id + '|' + z, productId: p.id, size: z, qty: q, updatedAt: '', updatedBy: '最初の値' });
      });
    });
    T.settings.push({ key: 'sampleData', value: JSON.stringify(!!withSamples) });
    if (!withSamples) return { tables: T, seq: seq };

    var now = u.nowOf(nowTs), today = now.date;
    /* 臨時休業と採寸の枠（見本） */
    T.holidays.push({ date: u.addDays(today, 12), reason: '臨時休業（見本）' });
    var slotDays = [5, 6, 8].map(function (d) { return u.addDays(today, d); });
    ['kamisu2', 'kamisu4'].forEach(function (sid, k) {
      slotDays.forEach(function (d) {
        if ([0, 4].indexOf(u.wd(d)) >= 0) return;
        [600, 660, 780, 840, 900].forEach(function (t) { T.measureSlots.push({ id: id('J'), schoolId: sid, date: d, start: t + k * 30, end: t + k * 30 + 30, capacity: 2 }); });
      });
    });

    /* 見本のお客様（架空） */
    var FAM = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤', '吉田', '山田', '佐々木', '山口', '松本', '井上', '木村', '林', '清水', '斎藤'];
    var KANA = ['サトウ', 'スズキ', 'タカハシ', 'タナカ', 'イトウ', 'ワタナベ', 'ヤマモト', 'ナカムラ', 'コバヤシ', 'カトウ', 'ヨシダ', 'ヤマダ', 'ササキ', 'ヤマグチ', 'マツモト', 'イノウエ', 'キムラ', 'ハヤシ', 'シミズ', 'サイトウ'];
    var GIV = ['花子', '美咲', '陽子', '恵', '由美', '直美', '健太', '翔', '真理', '彩'];
    var HEARD = ['Instagram', 'Instagram', 'Instagram', 'LINE', '学校のチラシ', '知り合いから', 'お店の前を通って', 'Googleマップ'];
    var schoolIds = M.SCHOOLS.map(function (s) { return s.id; });
    for (var i = 0; i < 28; i++) {
      var line = i % 3 !== 2, k = i % FAM.length;
      T.customers.push({
        id: id('C'), lineUserId: line ? 'Udemo' + (1000 + i) : '', lineName: line ? FAM[k] + '（LINE）' : '', name: FAM[k] + ' ' + GIV[i % GIV.length], kana: KANA[k] + ' ' + 'ハナコ',
        phone: '0900000' + String(1000 + i).slice(-4), email: line ? '' : 'sample' + i + '@example.com', schoolId: i < 18 ? schoolIds[i % schoolIds.length] : '',
        firstSource: line ? 'LINE' : (i % 2 ? 'instagram' : 'Web'), heardFrom: HEARD[i % HEARD.length], createdAt: u.addDays(today, -Math.floor(r() * 70)),
        blocked: i === 7, memo: '', marketingOk: false, mergedInto: ''
      });
    }
    var C = T.customers;

    /* サロンの予約：過去60日と、これから14日 */
    var menus = T.salonMenus, W = [[2, 30], [3, 32], [1, 14], [5, 6], [4, 6], [6, 6], [7, 6]];
    function pickMenu() { var x = r() * 100; for (var j = 0; j < W.length; j++) { x -= W[j][1]; if (x <= 0) return menus[W[j][0] - 1]; } return menus[1]; }
    var seatsUsed = {};
    function canPut(d, s, m) {
      var used = 0; for (var t = s; t < s + m.hold; t += 30) used = Math.max(used, seatsUsed[d + t] || 0);
      return used + m.seats <= 2;
    }
    function put(d, s, m) { for (var t = s; t < s + m.hold; t += 30) seatsUsed[d + t] = (seatsUsed[d + t] || 0) + m.seats; }
    for (var dd = -60; dd <= 14; dd++) {
      var d = u.addDays(today, dd);
      if ([1, 2, 3, 5, 6].indexOf(u.wd(d)) < 0) continue;
      var n = Math.floor(r() * 4) + (dd > 0 ? 0 : 1);
      for (var q = 0; q < n; q++) {
        var m = pickMenu(), start = 600 + Math.floor(r() * 14) * 30;
        if (start + m.hold > 1080 || !canPut(d, start, m)) continue;
        var cu = C[Math.floor(r() * C.length)];
        var past = dd < 0 || (dd === 0 && start < now.min);
        var st = past ? (r() < 0.9 ? '来店済み' : (r() < 0.5 ? '取り消し（お客様）' : '無断キャンセル')) : '予約';
        if (st !== '取り消し（お客様）') put(d, start, m);
        T.salonBookings.push({
          id: id('R'), token: u.token(), customerId: cu.id, menuId: m.id, menuName: m.name, date: d, start: start, end: start + m.mins, holdUntil: start + m.hold,
          seatIds: m.seats === 2 ? ['S1', 'S2'] : [(seatsUsed[d + start] || 1) > 1 ? 'S2' : 'S1'], party: m.seats, status: st,
          channel: cu.lineUserId ? 'LINE' : (r() < 0.5 ? 'Web' : '電話'), heardFrom: cu.heardFrom, note: '', price: m.price,
          createdAt: u.addDays(d, -Math.floor(r() * 10) - 1) + ' 12:00', createdDate: u.addDays(d, -Math.floor(r() * 10) - 1), reminded: past, utm: null,
          contact: { name: cu.name, phone: cu.phone, email: cu.email }
        });
      }
    }

    /* 取り置き（見本） */
    function prod(sid, name) { return T.products.filter(function (p) { return p.schoolId === sid && p.name === name; })[0]; }
    function order(ci, items, method, pickupDays, status, pay, payStatus, daysAgo) {
      var Cm = KS.core.c, cu = C[ci], lines = items.map(function (it) { var p = prod(it[0], it[1]); return { productId: p.id, size: it[2], qty: it[3], price: Cm.priceOf(p, it[2]), name: p.name, label: shortOf(it[0]) + ' ' + p.name + '（' + Cm.sizeLabel(p, it[2]) + '）', waitId: '' }; });
      var goods = u.sum(lines, function (l) { return l.price * l.qty; }), fee = method === '配送' ? 930 : 0;
      T.orders.push({
        id: id('T'), token: u.token(), customerId: cu.id, lines: lines, method: method, pickupDate: method === '店頭' ? u.addDays(today, pickupDays) : '',
        ship: method === '配送' ? { methodId: 'box', method: '宅配便（60サイズ）', fee: fee, zip: '3140000', addr: '茨城県神栖市（見本）', to: cu.name, tracking: '' } : null,
        pay: pay, payStatus: payStatus, payRef: pay === '事前' ? 'sq_demo_' + ci : '', payUrl: '', payDeadline: 0, status: status, goods: goods, shipFee: fee, total: goods + fee,
        contact: { name: cu.name, phone: cu.phone, email: cu.email }, channel: cu.lineUserId ? 'LINE' : 'Web', utm: null, note: '',
        createdAt: u.addDays(today, -daysAgo) + ' 19:20', createdDate: u.addDays(today, -daysAgo), remindedDayBefore: pickupDays <= 0, noShowNotified: pickupDays < 0, cancelReason: '', doneAt: '', legalVersion: 'v1'
      });
    }
    function shortOf(sid) { return M.SCHOOLS.filter(function (s) { return s.id === sid; })[0].short; }
    order(0, [['ikisu', '体操服 半そで', '120', 2], ['ikisu', '体操服 半ズボン', '120', 2], ['ikisu', '体操服 長そで', '130', 1]], '店頭', 0, '用意済み', '店頭', '店頭で', 3);
    order(1, [['kamisu2', '体操服 半袖', 'M', 2], ['kamisu2', 'ジャージ 上', 'M', 1]], '店頭', 2, '受付', '店頭', '店頭で', 1);
    order(3, [['fukashiba', '体操服 半そで', '130', 1]], '店頭', 0, '受付', '事前', '支払い済み', 2);
    order(4, [['onohara', '体操服 半ズボン', '140', 2]], '店頭', -2, '受付', '店頭', '店頭で', 6);
    order(5, [['kamisu4', 'ジャージ 下', 'L', 1]], '配送', 0, '受付', '事前', '支払い済み', 1);
    order(8, [['onoharanishi', '体育館シューズ', '21.0', 1], ['onoharanishi', '体操服 長ズボン', '175', 1]], '店頭', -5, '受け取り済み', '店頭', '店頭で', 9);
    order(9, [['ikisu', '体操服 半そで', '140', 1]], '店頭', 4, '取り消し', '店頭', '店頭で', 4);
    T.orders[T.orders.length - 1].cancelReason = 'お客様が取り消し';
    order(10, [['kamisu2', '体操服 半ズボン', 'L', 1]], '配送', 0, '発送済み', '事前', '支払い済み', 8);

    /* 入荷待ち（見本）：品切れのサイズに */
    var zero = T.stock.filter(function (s) { return s.qty === 0; });
    for (var w = 0; w < Math.min(8, zero.length); w++) {
      var s = zero[w], p = T.products.filter(function (x) { return x.id === s.productId; })[0], cu2 = C[(w * 3) % C.length];
      T.waits.push({ id: id('W'), token: u.token(), customerId: cu2.id, schoolId: p.schoolId, productId: p.id, size: s.size, createdAt: u.addDays(today, -w - 1) + ' 20:00', createdTs: nowTs - (w + 1) * 86400000, status: '待ち', notifiedAt: '', priorityUntil: 0, channel: cu2.lineUserId ? 'LINE' : 'メール' });
    }
    /* 採寸の予約（見本） */
    if (T.measureSlots.length) {
      T.measureBookings.push({ id: id('M'), token: u.token(), slotId: T.measureSlots[0].id, schoolId: T.measureSlots[0].schoolId, date: T.measureSlots[0].date, start: T.measureSlots[0].start, end: T.measureSlots[0].end, customerId: C[1].id, count: 1, children: '鈴木 そうた', status: '予約', createdAt: u.addDays(today, -1) + ' 21:10', reminded: false, contact: { name: C[1].name, phone: C[1].phone, email: '' }, note: '' });
    }
    /* お客様の声（見本）。点数で案内を分けない */
    var past2 = T.salonBookings.filter(function (b) { return b.status === '来店済み'; }).slice(-8);
    var TX = ['個室で落ち着けました。', 'スタッフの方の説明が丁寧でした。', '予約がしやすかったです。', '', '駐車場が分かりやすいとうれしいです。', 'また来ます。', '', '子どもの体操服も一緒に見られて便利でした。'];
    past2.forEach(function (b, j) { T.reviews.push({ id: id('V'), at: b.date + ' 19:00', date: b.date, customerId: b.customerId, refId: b.id, stars: [5, 5, 4, 5, 3, 5, 4, 5][j], text: TX[j], toShop: j === 4 ? '駐車場の案内があると助かります' : '', source: '予約' }); });
    /* お知らせの記録（見本）：今月の前日のお知らせ・入荷 */
    for (var nn = 0; nn < 14; nn++) T.notices.push({ id: id('N'), at: u.addDays(today, -nn) + ' 17:00', kind: nn % 4 === 0 ? '入荷' : '前日', template: '', customerId: C[nn].id, refId: '', channel: C[nn].lineUserId ? 'LINE' : 'メール', mode: C[nn].lineUserId ? 'push' : 'mail', count: C[nn].lineUserId ? 1 : 0, status: '送信済み', text: '（見本）', error: '' });
    return { tables: T, seq: seq };
  }

  /* 番号の形：受付番号は「T2611-0001」のように年月つき。ほかは頭の字＋番号 */
  function idOf(p, n, ts) {
    var d = u.nowOf(ts || Date.now()).date;
    if (p === 'T' || p === 'R' || p === 'M') return p + d.slice(2, 4) + d.slice(5, 7) + '-' + ('000' + n).slice(-4);
    return p + ('00000' + n).slice(-6);
  }

  return { initial: initial, idOf: idOf };
})();

;
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

;
/* ココスポーツ 本番：画面から裏側を呼ぶ口（試しの形でも本番でも、画面のコードは同じ）
   KS.api.call(name, args) → Promise<結果>
   - local：KS.local.call（このPCの中）
   - gas  ：Apps Script のウェブアプリに POST（text/plain にして、ブラウザの事前確認を起こさない）
   KS.line：LINEの中で開いたか、だれか（LIFF）。受付の確認は「返信」で送るために、受付番号をトークに送る。url(path) で LIFF の住所
   KS.shopAuth：店の画面のGoogleログイン */
KS.api = (function () {
  function call(name, args) {
    if (KS.config.backend !== 'gas') {
      return new Promise(function (resolve) { setTimeout(function () { resolve(KS.local.call(name, args)); }, 60); });
    }
    var body = JSON.stringify({ name: name, args: args || {}, idToken: KS.line.idToken(), inClient: KS.line.inClient(), shopToken: KS.shopAuth.token(), baseUrl: KS.config.baseUrl || (location.origin + location.pathname) });
    return fetch(KS.config.gasUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow' })
      .then(function (r) { return r.json(); })
      .then(function (r) { if (r && r.code === 'lineExpired' && window.liff && liff.login) { try { liff.login({ redirectUri: location.href }); } catch (e) { } } return r; })
      .catch(function () { return { ok: false, code: 'network', message: 'つながりませんでした。電波の良いところで、もう一度お試しください。' }; });
  }
  return { call: call };
})();

KS.line = (function () {
  var ready = false, inClient = false, token = '', profile = null;
  function loadSdk() {
    return new Promise(function (res, rej) {
      if (window.liff) return res();
      var s = document.createElement('script'); s.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
    });
  }
  /* 最初に1回。LIFF ID が無ければ（試しの形）何もしない */
  function init() {
    if (KS.config.backend !== 'gas' || !KS.config.liffId) { ready = true; return Promise.resolve(); }
    return loadSdk().then(function () { return liff.init({ liffId: KS.config.liffId }); }).then(function () {
      inClient = liff.isInClient();
      if (liff.isLoggedIn()) { token = liff.getIDToken() || ''; return liff.getProfile().then(function (p) { profile = p; }).catch(function () {}); }
    }).catch(function () { /* LINEにつながらなくても、LINEの外の人として続ける */ }).then(function () { ready = true; });
  }
  /* LINEで開き直す（C01 の「LINEで続ける」） */
  function openInLine(path) {
    if (KS.config.liffId) location.href = 'https://liff.line.me/' + KS.config.liffId + (path ? '/#/' + String(path).replace(/^#?\/?/, '') : '');
  }
  /* 受付のあと：トークに受付番号を送ると、裏側が「返信」で確認を返す（通数を使わない） */
  function afterReceive(id) {
    if (!(inClient && window.liff && liff.sendMessages)) return Promise.resolve(false);
    return liff.sendMessages([{ type: 'text', text: '【受付】' + id }]).then(function () { return true; }).catch(function () { return false; });
  }
  function close() { if (inClient && window.liff) liff.closeWindow(); }
  /* お客様の画面の住所（リッチメニュー・自動の返事に入れる形）。path は 'c/school' など。
     liffId があれば https://liff.line.me/<LIFF_ID>/#/c/school、空ならこのページの #/c/school */
  function url(path) {
    var h = '#/' + String(path || '').replace(/^#?\/?/, '');
    if (KS.config.liffId) return 'https://liff.line.me/' + KS.config.liffId + '/' + h;
    return (KS.config.baseUrl || (location.origin + location.pathname)) + h;
  }
  return { init: init, url: url, idToken: function () { return token; }, inClient: function () { return inClient; }, profile: function () { return profile; }, openInLine: openInLine, afterReceive: afterReceive, close: close, ready: function () { return ready; } };
})();

KS.shopAuth = (function () {
  var KEY = 'kokosports_shop_token', tok = '';
  try { tok = sessionStorage.getItem(KEY) || ''; } catch (e) { tok = ''; }
  function token() { return tok; }
  function set(t) { tok = t || ''; try { sessionStorage.setItem(KEY, tok); } catch (e) { } }
  /* Google のボタンを出す（本番）。試しの形では画面の側でメールを選ぶ */
  function renderButton(el, onDone) {
    if (KS.config.backend !== 'gas' || !KS.config.googleClientId) return false;
    var go = function () {
      google.accounts.id.initialize({ client_id: KS.config.googleClientId, callback: function (r) { set(r.credential); onDone(); }, auto_select: true });
      google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ja' });
    };
    if (window.google && google.accounts) go();
    else { var s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.onload = go; document.head.appendChild(s); }
    return true;
  }
  function logout() { set(''); if (KS.config.backend !== 'gas') KS.local.dev.shopLogin(''); }
  return { token: token, set: set, renderButton: renderButton, logout: logout };
})();

;
/* ココスポーツ 本番：画面の共通部品（お客様・店・ボードで使う） */
KS.views = KS.views || {};
KS.ui = (function () {
  var u = KS.core.u;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  /* 改行を <br> に（esc したあと） */
  function br(s) { return esc(s).replace(/\n/g, '<br>'); }
  var I = {
    shirt: '<path d="M8 3l4 2 4-2 5 3-2 4-2-1v11H7V9L5 10 3 6z"/>',
    drop: '<path d="M12 3c4 5.5 6 8.6 6 11.5a6 6 0 0 1-12 0C6 11.6 8 8.5 12 3z"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    pin: '<path d="M12 21s7-6.5 7-11.5a7 7 0 0 0-14 0C5 14.5 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.3"/>',
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', next: '<path d="M9 5l7 7-7 7"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    home: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', bag: '<path d="M6 8h12l-1 12H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    msg: '<path d="M4 5h16v11H8l-4 4z"/>', bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>', ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>', truck: '<path d="M2 6h11v10H2zM13 10h5l3 3v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', insta: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="12" cy="12" r="3.5"/><path d="M17 7h.01"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>', line: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9v4M11 9v4M14 9v4l2-4v4"/>', search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/>'
  };
  function ico(n, cls) { return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (I[n] || '') + '</svg>'; }

  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg; el.classList.add('on');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('on'); }, 2800);
  }
  /* 入力欄。値は data-f="名前" で集める（form() を使う） */
  function field(id, label, o) {
    o = o || {};
    var err = o.err ? '<div class="errtxt">' + esc(o.err) + '</div>' : '';
    var req = o.req === false ? '<span class="req">任意</span>' : (o.req ? '<span class="req">必須</span>' : '');
    var input;
    if (o.select) {
      input = '<select class="inp' + (o.err ? ' err' : '') + '" data-f="' + id + '"' + (o.change ? ' data-change="' + o.change + '"' : '') + '>' + (o.noBlank ? '' : '<option value="">選んでください</option>') +
        o.select.map(function (x) { var v = typeof x === 'object' ? x.value : x, t = typeof x === 'object' ? x.label : x; return '<option value="' + esc(v) + '"' + (String(v) === String(o.value) ? ' selected' : '') + (x.disabled ? ' disabled' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>';
    } else if (o.textarea) {
      input = '<textarea class="inp' + (o.err ? ' err' : '') + '" data-f="' + id + '" placeholder="' + esc(o.ph || '') + '">' + esc(o.value || '') + '</textarea>';
    } else {
      input = '<input class="inp' + (o.err ? ' err' : '') + '" data-f="' + id + '" type="' + (o.type || 'text') + '" inputmode="' + (o.mode || 'text') + '" autocomplete="' + (o.ac || 'off') + '" value="' + esc(o.value == null ? '' : o.value) + '" placeholder="' + esc(o.ph || '') + '">';
    }
    return '<div class="field"><label>' + esc(label) + req + '</label>' + input + (o.help ? '<div class="help">' + o.help + '</div>' : '') + err + '</div>';
  }
  function check(id, html, o) {
    o = o || {};
    return '<label class="chk"><input type="checkbox" data-f="' + id + '"' + (o.value ? ' checked' : '') + '><span>' + html + '</span></label>' + (o.err ? '<div class="errtxt">' + esc(o.err) + '</div>' : '');
  }
  /* scope（要素）の中の data-f を集める */
  function form(scope) {
    var out = {};
    (scope || document).querySelectorAll('[data-f]').forEach(function (el) {
      out[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
    });
    return out;
  }
  function confirmBox(msg) { return window.confirm(msg); }

  /* 店の画面の帯グラフ */
  function bars(rows, o) {
    o = o || {};
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
    return '<div class="bars">' + rows.map(function (r) {
      return '<div class="row"><span>' + esc(r[0]) + '</span><div class="track"><div class="fill ' + (o.sky ? 'sky' : '') + '" style="width:' + (r[1] / max * 100) + '%"></div></div><span class="v">' + (o.fmt ? o.fmt(r[1]) : u.num(r[1])) + '</span></div>';
    }).join('') + '</div>';
  }
  function cols(rows, o) {
    o = o || {};
    var max = Math.max.apply(null, rows.map(function (r) { return r[1]; }).concat([1]));
    return '<div class="cols">' + rows.map(function (r) {
      return '<div class="c"><span>' + (o.fmt ? o.fmt(r[1]) : u.num(r[1])) + '</span><i class="' + (r[2] || '') + '" style="height:' + Math.max(2, r[1] / max * 120) + 'px"></i></div>';
    }).join('') + '</div><div class="colx">' + rows.map(function (r) { return '<span>' + esc(r[0]) + '</span>'; }).join('') + '</div>';
  }
  function loading() { return '<div class="loading">読み込んでいます…</div>'; }

  /* 画面の外にまたがる小さな保存（かごのID・入口の印・入力の途中）。消えても動く */
  var mem = {};
  function keep(k, v) {
    if (arguments.length === 1) { if (k in mem) return mem[k]; try { var raw = localStorage.getItem('ks_' + k); return raw ? JSON.parse(raw) : null; } catch (e) { return null; } }
    mem[k] = v; try { if (v == null) localStorage.removeItem('ks_' + k); else localStorage.setItem('ks_' + k, JSON.stringify(v)); } catch (e) { }
    return v;
  }
  function cartId() { var c = keep('cartId'); if (!c) c = keep('cartId', u.token()); return c; }

  return { esc: esc, br: br, ico: ico, toast: toast, field: field, check: check, form: form, confirm: confirmBox, bars: bars, cols: cols, loading: loading, keep: keep, cartId: cartId, u: u };
})();

;
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

;
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
  function recvTxt(o) { return o.type === '予約' ? '予約（入荷のあと）' : o.method === '配送' ? '配送' + (o.ship ? '・' + esc(o.ship.method) : '') : '店頭 ' + (o.pickupDate ? u.shortDate(o.pickupDate) : ''); }
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
        return row('<span class="tm">' + tm(b) + '</span>' + clink(b.customer), (b.type === '試着' ? '試着・' : '') + esc(b.school) + '・' + b.count + '人（' + esc(b.children) + '）', act);
      }).join('') || empty('この日の試着・採寸はありません');
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
        : o.type === '予約' ? '予約（入荷のあと、先着順にお渡し）<div class="t2s">そろったら「用意済み」を押すと、お客様に知らせます</div>'
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

  var SHOP_F = [['name', '店の名前'], ['address', '住所'], ['tel', '電話'], ['hours', '営業時間（お客様に見せる書き方）'], ['closedText', '定休日（書き方）'], ['instagram', 'Instagram のリンク'], ['map', '地図のリンク'], ['lineAddUrl', '公式LINEの友だち追加のリンク'], ['airReserve', 'Airリザーブのリンク（サロンを切り替えるまで）'], ['googleReviewUrl', 'Googleの口コミの住所（ご感想のあとに案内する）'], ['owner', '運営責任者'], ['manager', '店長']];
  var TPL = [['order_received', '取り置きの受付'], ['order_paid', '支払いの確認'], ['order_dayBefore', '取り置きの前日'], ['order_noShow', '受け取り日を過ぎたとき'], ['order_cancelled', '取り置きの取り消し'], ['order_shipped', '発送'], ['restock', '入荷'],
    ['preorder_received', '予約の受付'], ['preorder_ready', '予約の品の用意ができた'], ['fit_received', '試着の受付'], ['fit_dayBefore', '試着の前日'], ['measure_received', '採寸の受付'], ['measure_dayBefore', '採寸の前日'], ['salon_received', 'サロンの受付'], ['salon_changed', 'サロンの日時の変更'], ['salon_cancelled', 'サロンの取り消し'], ['salon_dayBefore', 'サロンの前日']];
  var NUMS = [['pickup', 'fromDays', '受け取り日：何日後から選べるか', '日'], ['pickup', 'toDays', '受け取り日：何日後まで選べるか', '日'], ['pickup', 'keepDays', '受け取り日を過ぎて取り消すまで', '日'],
    ['cart', 'holdMin', 'かごに入れた品を押さえる時間', '分'], ['cart', 'lowStock', '「残りわずか」と見せる数', '個以下'], ['restock', 'priorityHours', '入荷のお知らせのあと優先する時間', '時間'],
    ['payment', 'deadlineMin', 'ネットの支払いを待つ時間', '分'], ['salon', 'deadlineMin', 'サロン：ネットの受付の締め切り', '分前'], ['salon', 'cancelMin', 'サロン：ネットで取り消せるのは', '分前まで'],
    ['salon', 'horizonDays', 'サロン：何日先まで受け付けるか', '日'], ['line', 'monthlyQuota', 'LINEの月の無料通数', '通'], ['line', 'stopReminderUnder', '前日のお知らせを止める残り', '通を切ったら']];
  var STAGES = [['price', '体操服の料金表（取り置きを始める前でも見せる）'], ['reserve', '体操服の予約（すぐ予約・来店して試着。開ける学校は設定の reserve）'], ['order', '体操服などの取り置き（在庫の表示・かご・入荷のお知らせ）'], ['measure', '採寸の予約'], ['ship', '配送'], ['prepay', 'ネットで先に払う'], ['salon', '水素サロンの予約'], ['voice', 'お客様の声（来店のあとに聞く）']];
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
      return '<div class="frm" id="cf"><section class="card"><div class="fgrid">' + SHOP_F.map(function (x) { return ui.field(x[0], x[1], { value: s[x[0]], req: false }); }).join('') + '</div></section></div>' +
        /* 口コミの住所の作り方。案内は点数で分けない（D-004・Googleの決まり） */
        '<details class="rules"><summary>Googleの口コミの住所の作り方</summary><ul>' +
        '<li>Googleビジネスプロフィール（お店のGoogleアカウント）で「クチコミを依頼」（または「クチコミを増やす」）を押すと、短い住所（https://g.page/r/… の形）が出ます。それを「コピー」して、上の欄に貼ります。</li>' +
        '<li>短い住所が出ないときは、お店の「場所ID」を調べて https://search.google.com/local/writereview?placeid=場所ID の形にします（場所IDは Google の「Place ID Finder」でお店の名前を探すと出ます）。</li>' +
        '<li>貼ったら保存して、お客様の画面の「ご感想」を送ったあとの「Googleにご感想を書く」を押し、お店の口コミを書く画面が開くか確かめます。</li>' +
        '<li>この住所は、ご感想を送ったすべての方に同じ文で案内します。星の数で案内を変えたり、特典と引き換えにお願いしたりはしません（Googleの決まりで禁止されています）。</li>' +
        '<li>空のときは、Googleの案内を出さずに「いただいた声は、お店の改善に使わせていただきます」とだけ出します。</li></ul></details>' + saveBar('sCfgShop');
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

;
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

;
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
        '・大野原小・大野原西小の体操服のご予約と、試着のご来店予約\n' +
        '・水素サロンのご予約\n' +
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

;
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

;
/* ココスポーツ 本番：画面の切り替えと操作の受け付け
   住所（#）の形：#/c/…  お客様（C00〜C90）／ #/s/…  店（S00〜S08）／ #/b/…  運営ボード（B01〜B07）
                  #/l  試しのLINEのトーク画面（試しの形だけ。本番では KS.views.l が無いのでお客様の画面になる）
   画面の部品は KS.views.c / s / b / l がそれぞれ持つ：
     route(rest, params) → HTML か Promise<HTML>（rest は住所の残り、params は ? の後ろ）
     actions[name](el, event) → 何か／Promise。終わったら描き直す（false を返したら描き直さない）
     after(rest, params)（任意）→ 描いた直後に呼ぶ */
KS.views = KS.views || {};
KS.app = (function () {
  var ui = KS.ui, busy = false, seq = 0;

  function parse() {
    var h = location.hash.replace(/^#\/?/, '') || 'c';
    var q = '', i = h.indexOf('?');
    if (i >= 0) { q = h.slice(i + 1); h = h.slice(0, i); }
    var parts = h.split('/').filter(Boolean).map(decodeURIComponent);
    var params = {};
    q.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    return { area: parts[0] || 'c', rest: parts.slice(1), params: params };
  }
  /* 入口の印（UTM）を覚える。取り置き・予約に一緒に保存する */
  function takeUtm(p) {
    if (p.utm_source) ui.keep('utm', { source: p.utm_source, medium: p.utm_medium || '', campaign: p.utm_campaign || '', content: p.utm_content || '', at: Date.now() });
  }
  function utm() { var x = ui.keep('utm'); return x && Date.now() - x.at < 30 * 86400000 ? { source: x.source, medium: x.medium, campaign: x.campaign, content: x.content } : null; }

  function wrap(area, inner) {
    var dev = KS.config.backend !== 'gas' && KS.views.dev ? KS.views.dev.panel(area) : '';
    if (area === 'c' || area === 'l') return '<div class="custwrap' + (dev ? ' withdev' : '') + '"><main class="cust' + (area === 'l' ? ' ln' : '') + '" id="scr">' + inner + '</main>' + dev + '</div>';
    return '<div class="bizwrap area-' + area + '">' + inner + '</div>' + (dev ? '<div class="devdock">' + dev + '</div>' : '');
  }

  /* 戻る（お客様の画面の左上）
     各画面の history.state に「アプリの中で何枚目か（ksDepth）」を書いておく。
     - 2枚目以降：ひとつ前の画面がアプリの中にあるので history.back()
     - 1枚目（LINEのメニュー・お知らせ・メールのリンクから直接開いた画面。LIFF では liff.state で入った画面）：
       その画面の親へ。今の住所を置き換えるので、戻るを重ねても行き来しない
     画面の中の自動の切り替え（C10→前に選んだ学校の C11 など）は replace を使い、枚数を増やさない */
  var depth = 0, replacing = null, lastLen = 0;
  function norm(h) { h = String(h || '').replace(/^#?\/?/, ''); try { return decodeURIComponent(h); } catch (e) { return h; } }
  function mark() {
    var st = history.state, rep = replacing, len = history.length, grew = len > lastLen;
    replacing = null; lastLen = len;
    if (rep != null && norm(location.hash) === norm(rep)) { if (!depth) depth = 1; }   /* 自分で置き換えた */
    else if (st && st.ksDepth) { depth = st.ksDepth; return; }                         /* 戻る・進む・読み込み直し */
    else if (grew || !depth) depth += 1;                                               /* 新しい画面に進んだ */
    /* ほかに履歴が増えずに住所が変わったとき（LIFF などの置き換え）は、枚数をそのままにする */
    try { history.replaceState({ ksDepth: depth }, '', location.href); } catch (e) { }
  }
  function replace(path) {
    var h = '#/' + String(path).replace(/^#?\/?/, '');
    if (norm(location.hash) === norm(h)) { render(); return; }
    replacing = h; location.replace(h);
  }
  function back(parent) {
    if (depth > 1) history.back();
    else replace(parent || 'c');
  }

  function render() {
    mark();
    var p = parse(), my = ++seq;
    if (p.area === 'l' && !KS.views.l) p.area = 'c';   /* 本番では試しのLINEは無い */
    takeUtm(p.params);
    var view = KS.views[p.area] || KS.views.c;
    var out;
    try { out = view.route(p.rest, p.params); } catch (e) { out = errorPage(e); }
    Promise.resolve(out).then(function (html) {
      if (my !== seq) return;
      var same = render._last === location.hash.split('?')[0];
      var y = window.scrollY;
      document.getElementById('app').innerHTML = wrap(p.area, html);
      document.title = titleOf(p.area);
      window.scrollTo(0, same ? y : 0);
      render._last = location.hash.split('?')[0];
      if (view.after) view.after(p.rest, p.params);
    }).catch(function (e) { document.getElementById('app').innerHTML = wrap(p.area, errorPage(e)); });
  }
  function titleOf(a) { return a === 's' ? 'ココスポーツ 店の画面' : a === 'b' ? 'ココスポーツ 運営ボード' : a === 'l' ? 'ココスポーツ LINEの試し' : 'ココスポーツ'; }
  function errorPage(e) {
    if (window.console) console.error(e);
    return '<div class="c-body"><div class="notice ng">画面を表示できませんでした。もう一度開いてください。<br>お急ぎの方はお電話で：0299-92-0272</div></div>';
  }
  function go(path) { var h = '#/' + String(path).replace(/^#?\/?/, ''); if (location.hash === h) render(); else location.hash = h; }

  function allActions() {
    var a = {};
    ['c', 's', 'b', 'l', 'dev'].forEach(function (k) { var v = KS.views[k]; if (v && v.actions) for (var n in v.actions) a[n] = v.actions[n]; });
    return a;
  }
  function run(name, el, ev) {
    var fn = allActions()[name]; if (!fn || busy) return;
    busy = true; document.body.classList.add('busy');
    var r;
    try { r = fn(el, ev); } catch (e) { busy = false; document.body.classList.remove('busy'); ui.toast('うまくいきませんでした'); if (window.console) console.error(e); return; }
    Promise.resolve(r).then(function (res) { busy = false; document.body.classList.remove('busy'); if (res !== false) render(); })
      .catch(function (e) { busy = false; document.body.classList.remove('busy'); ui.toast('うまくいきませんでした'); if (window.console) console.error(e); });
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'SELECT') return;
    if (el.tagName === 'INPUT' && el.type !== 'button' && el.type !== 'checkbox' && el.type !== 'radio') return;
    if ((el.type === 'checkbox' || el.type === 'radio') && !el.dataset.act) return;
    if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
    if (el.disabled) return;
    run(el.dataset.act, el, e);
  });
  document.addEventListener('change', function (e) { var el = e.target; if (el.dataset && el.dataset.change) run(el.dataset.change, el, e); });
  document.addEventListener('submit', function (e) { e.preventDefault(); });
  window.addEventListener('hashchange', render);

  function start() { KS.line.init().then(render); }
  return { render: render, go: go, replace: replace, back: back, parse: parse, utm: utm, start: start };
})();
KS.app.start();
