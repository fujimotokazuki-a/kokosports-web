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

  function render() {
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
  return { render: render, go: go, parse: parse, utm: utm, start: start };
})();
KS.app.start();
