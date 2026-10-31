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
