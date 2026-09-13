// 👑 スクロールに合わせて要素をふわっと浮かび上がらせる演出。
// data-reveal 属性を付けた要素だけを対象にする。一度表示された要素は監視を外し、
// スクロールを行き来するたびに点滅（再フェード）しないようにしている。
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
            if (entry.isIntersecting) {
                entry.target.classList.add('is-revealed');
                io.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.15,
        rootMargin: '0px 0px -8% 0px'
    });

    targets.forEach(function (el) {
        io.observe(el);
    });
})();
