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
