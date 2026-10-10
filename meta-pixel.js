// Meta（Instagram/Facebook広告）の計測ピクセル。全ページの<head>から読み込む。
// IDが空のあいだは何もしない
(function () {
  var PIXEL_ID = '1576719573665724';
  if (!PIXEL_ID || window.fbq) return;

  // Meta公式スニペット（fbqのキューを作ってから fbevents.js を読む）
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
    t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', PIXEL_ID);
  fbq('track', 'PageView');

  // エントリーサイトへのリンクを押したら「Lead」（申し込みに興味を示した）
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="entry.fantasista-cup.com"]');
    if (a) fbq('track', 'Lead');
  });
})();
