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
