/* ココスポーツ 本番：表の形と、最初に入れておく値
   - 表の正本は、店のGoogleアカウントのスプレッドシート（試しの形ではブラウザの中）
   - 小学校4校の品物と価格は、お店の価格表（2026-11-01）どおり。中学校と反射タスキは「仮」で、届いたら S08 設定 で入れ替える
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
      /* 作った段階のうち、お客様に見せるもの（画面遷移 v02 第5章） */
      stages: { order: true, measure: true, ship: true, prepay: true, salon: true, voice: true },
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
        sizeGuide: opts.guide || '', note: opts.note || '', photo: '', visible: true, sort: n
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
