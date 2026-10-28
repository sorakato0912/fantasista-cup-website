// 👑 スクロールに合わせた演出をまとめて担当する。
// ・ページ全体に1つだけ敷いた背景の靄（.page-glow）を、スクロール量に応じてなめらかに動かす。
//   sin/cos でゆるやかに往復させ、どれだけ下までスクロールしても画面の外へ流れて消えない。
// ・トップ動画のパララックス：動画は遅れて流れながら少し拡大し、キャッチコピーは速めに上へ抜けて薄くなる。
// ・ENTRYの大会カード：一覧が画面に入ったら .is-inview を付け、CSS側で上から順に表示する。
// ・大会参加までの流れ：スクロールに合わせて金のラインを伸ばし、通過したステップを点灯させる。
// prefers-reduced-motion（アニメーション低減設定）の場合は何も動かさない
// （html に .fc-motion を付けないので、CSS側の演出もすべて無効のまま最初から表示される）。
(function () {
    // 大会参加までの流れのラインは、最後のステップ（04 大会当日）の丸の中心で止める。
    // 最初の丸の中心（上から28px）から最後の丸の中心までの長さを --fc-line-span に入れ、
    // CSS側の薄いライン（::before）と金のライン（::after）の長さに使う。演出を切っていても測る
    const timelineEl = document.querySelector('.steps-timeline');
    const timelineMarkers = timelineEl ? timelineEl.querySelectorAll('.step-marker') : [];
    function measureTimelineSpan() {
        if (!timelineEl || !timelineMarkers.length) return 0;
        const last = timelineMarkers[timelineMarkers.length - 1];
        const top = timelineEl.getBoundingClientRect().top;
        const r = last.getBoundingClientRect();
        const span = Math.max(1, r.top + r.height / 2 - top - 28);
        timelineEl.style.setProperty('--fc-line-span', span + 'px');
        return span;
    }
    measureTimelineSpan();
    window.addEventListener('resize', measureTimelineSpan);
    window.addEventListener('load', measureTimelineSpan);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    document.documentElement.classList.add('fc-motion');

    const glow = document.querySelector('.page-glow');
    const hero = document.querySelector('.hero');
    const heroVideo = hero && hero.querySelector('.hero-video');
    const heroContent = hero && hero.querySelector('.hero-content');
    const timeline = document.querySelector('.steps-timeline');
    const steps = timeline ? [].slice.call(timeline.querySelectorAll('.step-item')) : [];

    const entryList = document.getElementById('entryTournamentList');
    if (entryList) {
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(function (entries) {
                if (entries.some(function (e) { return e.isIntersecting; })) {
                    entryList.classList.add('is-inview');
                    io.disconnect();
                }
            }, { threshold: 0.15 });
            io.observe(entryList);
        } else {
            entryList.classList.add('is-inview');
        }
    }

    let ticking = false;

    function update() {
        const y = window.scrollY;
        const vh = window.innerHeight;

        if (glow) {
            // 割る数を小さくする＝短いスクロール量で往復が進む＝動きが速く感じられる。
            // 掛ける幅（振れ幅）を広げる＝画面内での移動距離そのものが大きくなる。
            const t1 = (Math.sin(y / 480) + 1) / 2;
            const t2 = (Math.cos(y / 620) + 1) / 2;
            glow.style.setProperty('--gx1', (5 + t1 * 55) + '%');
            glow.style.setProperty('--gy1', (0 + t2 * 55) + '%');
            glow.style.setProperty('--gx2', (45 + t2 * 55) + '%');
            glow.style.setProperty('--gy2', (45 + t1 * 55) + '%');
        }

        if (hero && heroVideo && heroContent) {
            const h = hero.offsetHeight;
            if (y <= h) {
                const p = y / h;
                heroVideo.style.transform = 'translate(-50%, calc(-50% + ' + (y * 0.35) + 'px)) scale(' + (1 + p * 0.08) + ')';
                heroContent.style.transform = 'translateY(' + (-y * 0.2) + 'px)';
                heroContent.style.opacity = String(Math.max(0, 1 - p * 1.3));
            }
        }

        // IntersectionObserver が使えない・動かない環境向けに、スクロール位置でも判定しておく
        if (entryList && !entryList.classList.contains('is-inview') && entryList.getBoundingClientRect().top < vh * 0.9) {
            entryList.classList.add('is-inview');
        }

        if (timeline) {
            // 画面の上から60%の位置を「読んでいる位置」とみなし、そこまでラインを伸ばす
            const line = vh * 0.6;
            const rect = timeline.getBoundingClientRect();
            const progress = Math.min(1, Math.max(0, (line - rect.top - 28) / measureTimelineSpan()));
            timeline.style.setProperty('--fc-progress', progress.toFixed(4));
            steps.forEach(function (step) {
                const marker = step.querySelector('.step-marker');
                if (!marker) return;
                const r = marker.getBoundingClientRect();
                step.classList.toggle('is-reached', r.top + r.height / 2 <= line);
            });
        }

        ticking = false;
    }

    function onScroll() {
        if (!ticking) {
            window.requestAnimationFrame(update);
            ticking = true;
        }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
})();
