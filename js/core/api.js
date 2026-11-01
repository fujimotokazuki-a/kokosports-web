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
    orderDone: { fn: G.orderDone, role: 'public', write: true },
    devPay: { fn: G.devPay, role: 'public', write: true, devOnly: true },
    waitAdd: { fn: G.waitAdd, role: 'public', write: true, stage: 'order' },
    restockOpen: { fn: G.restockOpen, role: 'public', write: true, stage: 'order' },
    measureSchools: { fn: B.measureSchools, role: 'public' },
    measureSlots: { fn: B.measureSlots, role: 'public' },
    measureBook: { fn: B.measureBook, role: 'public', write: true, stage: 'measure' },
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
