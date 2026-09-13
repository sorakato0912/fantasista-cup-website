// 👑 スクロールに合わせて、セクション全体に「モヤ（ぼかし）」がかかったり
// 晴れたりする演出。data-reveal 属性を付けた要素だけを対象にする。
// 一度きりの表示ではなく、画面内にあるかどうかを常に監視して is-revealed を
// 付け外しするので、下にスクロールしたときも、上に戻したときも、その都度
// モヤがかかる／晴れるを繰り返す。
// prefers-reduced-motion（アニメーション低減設定）の場合は、演出なしで即座に表示する。
(function () {
    const targets = document.querySelectorAll('[data-reveal]');
    if (targets.length === 0) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!('IntersectionObserver' in window) || reduceMotion) {
        targets.forEach(function (el) {
            el.classList.add('is-revealed');
        });
        return;
    }

    const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            entry.target.classList.toggle('is-revealed', entry.isIntersecting);
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px'
    });

    targets.forEach(function (el) {
        io.observe(el);
    });
})();
