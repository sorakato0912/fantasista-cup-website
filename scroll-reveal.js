// 👑 ページ全体に1つだけ敷いた背景の靄（.page-glow）を、スクロール量に応じて
// なめらかに動かす演出。セクションごとに現れたり消えたりする「ブロック」では
// なく、ページ全体を通じて一続きに漂う靄として見せるのが狙い。
// sin/cos を使い、スクロール量に対してゆるやかに往復させることで、
// どれだけ下までスクロールしても靄が画面の外へ流れて消えてしまわないように
// している（＝常にスクロールに追従して動き続ける）。
// prefers-reduced-motion（アニメーション低減設定）の場合は演出自体を止める
// （CSS側で .page-glow を非表示にしている）。
(function () {
    const glow = document.querySelector('.page-glow');
    if (!glow) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    let ticking = false;

    function update() {
        const y = window.scrollY;
        const t1 = (Math.sin(y / 900) + 1) / 2;
        const t2 = (Math.cos(y / 1300) + 1) / 2;

        glow.style.setProperty('--gx1', (15 + t1 * 25) + '%');
        glow.style.setProperty('--gy1', (10 + t2 * 30) + '%');
        glow.style.setProperty('--gx2', (65 + t2 * 25) + '%');
        glow.style.setProperty('--gy2', (55 + t1 * 35) + '%');

        ticking = false;
    }

    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(update);
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    update();
})();
