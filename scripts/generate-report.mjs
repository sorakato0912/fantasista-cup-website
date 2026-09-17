#!/usr/bin/env node
// Fantasista Cup 大会レポート自動生成スクリプト
// 使い方: node scripts/generate-report.mjs scripts/report-data/vol3.json
//
// data JSONのblocks配列に書いた内容から blog-volX-report.html を生成し、
// blog.html（一覧）と sitemap.xml に新記事を自動で差し込みます。
// 生成されるHTMLの見た目・構造は blog-vol1-report.html をベースにしています。

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const dataPath = process.argv[2];
if (!dataPath) {
  console.error('使い方: node scripts/generate-report.mjs <data.jsonのパス> [--dry-run]');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');

const data = JSON.parse(readFileSync(path.resolve(dataPath), 'utf8'));

const required = ['volume', 'slug', 'dateISO', 'dateDisplay', 'pageTitle', 'metaDescription', 'ogImage', 'ogImageAlt', 'cardExcerpt', 'blocks'];
for (const key of required) {
  if (!(key in data)) {
    console.error(`data JSONに必須項目 "${key}" がありません`);
    process.exit(1);
  }
}

const slugFile = `${data.slug}.html`;
const outPath = path.join(ROOT, slugFile);
if (!dryRun && existsSync(outPath)) {
  console.error(`${slugFile} は既に存在します。上書きを避けるため中断しました。`);
  process.exit(1);
}

function esc(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// blocks -> 記事本文HTML（blog-vol1-report.htmlの構造に合わせる）
function renderBlocks(blocks) {
  let html = '';
  let inSection = false;
  const closeSection = () => {
    if (inSection) {
      html += '                    </div>\n';
      inSection = false;
    }
  };
  for (const block of blocks) {
    if (block.type === 'h2') {
      closeSection();
      html += `                    <h2>${esc(block.text)}</h2>\n`;
      html += '                    <div class="article-section">\n';
      inSection = true;
    } else if (block.type === 'p') {
      const indent = inSection ? '                        ' : '                    ';
      html += `${indent}<p>${block.html || esc(block.text)}</p>\n`;
    } else if (block.type === 'list') {
      const indent = inSection ? '                        ' : '                    ';
      html += `${indent}<ul>\n`;
      for (const item of block.items) {
        html += `${indent}    <li>${item.html || esc(item.text || item)}</li>\n`;
      }
      html += `${indent}</ul>\n`;
    } else if (block.type === 'photo') {
      closeSection();
      html += '                    <div class="article-photo">\n';
      html += `                        <img src="${esc(block.src)}" alt="${esc(block.alt)}">\n`;
      html += '                    </div>\n';
      if (block.caption) {
        html += `                    <p class="article-photo-caption">${esc(block.caption)}</p>\n`;
      }
    } else if (block.type === 'cta') {
      closeSection();
      html += '                    <div class="article-cta">\n';
      html += `                        <p>${esc(block.label)}</p>\n`;
      html += '                        <div class="article-cta-buttons">\n';
      html += '                            <a href="https://entry.fantasista-cup.com/home" target="_blank" rel="noopener noreferrer" class="btn-action">エントリーサイトを見る</a>\n';
      html += `                            <a href="${esc(block.href)}" class="btn-action-secondary">${esc(block.text)}</a>\n`;
      html += '                        </div>\n';
      html += '                        <div style="margin-top: 18px;">\n';
      html += '                            <a href="https://lin.ee/rGbe5tV" target="_blank" rel="noopener noreferrer" class="faq-line-cta" style="margin-top: 0;">\n';
      html += '                                <i class="fab fa-line"></i>\n';
      html += '                                <span>大会公式LINEを友だち追加</span>\n';
      html += '                            </a>\n';
      html += '                        </div>\n';
      html += '                    </div>\n';
    }
  }
  closeSection();
  return html;
}

const articleBodyHtml = renderBlocks(data.blocks);

const jsonLd = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: data.pageTitle,
  datePublished: data.dateISO,
  author: { '@type': 'Organization', name: 'Fantasista Cup 運営事務局' },
  publisher: { '@type': 'Organization', name: 'Fantasista Cup 運営事務局' },
  image: data.ogImage,
  description: data.metaDescription,
}, null, 2).replace(/\n/g, '\n    ');

const reportHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- 👑 SEO対策：title / meta description -->
    <title>${esc(data.pageTitle)}</title>
    <meta name="description" content="${esc(data.metaDescription)}">

    <!-- ==========================================
       👑 ファビコン・アイコン限界最大化設定
       ========================================== -->
    <link rel="icon" href="rogo2.png" type="image/png" sizes="any">
    <link rel="apple-touch-icon" href="rogo2.png">

    <!-- ==========================================
       👑 OGP（SNSなどでシェアされた際の表示設定）
       ========================================== -->
    <meta property="og:type" content="article">
    <meta property="og:title" content="${esc(data.pageTitle)}">
    <meta property="og:description" content="${esc(data.metaDescription)}">
    <meta property="og:image" content="${esc(data.ogImage)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(data.pageTitle)}">
    <meta name="twitter:image" content="${esc(data.ogImage)}">

    <link rel="stylesheet" href="style.css">
    <!-- Google Fontsから明朝体（Noto Serif JP）を読み込み -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap" rel="stylesheet">
    <!-- 各種アイコン表示用に Font Awesomeを読み込み -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">

    <!-- 💡 ナビバー演出（index.html・faq.html・tokushoho.html・blog.htmlと共通） -->
    <style>
        /* ナビバーの半透明化＋ぼかしは style.css の .navbar に統一済み */
        .nav-links li {
            position: relative;
        }
        .nav-links a.active,
        .nav-links a.current {
            color: #ffffff !important;
            text-shadow: 0 0 8px rgba(255, 215, 0, 0.6);
        }
        .nav-links a:hover {
            color: #ffffff !important;
        }
        .nav-links a::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 115%;
            height: 140%;
            transform: translate(-50%, -50%) scaleX(0);
            background: linear-gradient(90deg,
                rgba(212, 175, 55, 0) 0%,
                rgba(255, 223, 128, 0.7) 25%,
                rgba(170, 124, 17, 0.8) 50%,
                rgba(255, 223, 128, 0.7) 75%,
                rgba(212, 175, 55, 0) 100%
            );
            background-size: 200% auto;
            z-index: -1;
            transition: transform 0.4s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.4s;
            opacity: 0;
            pointer-events: none;
            box-shadow: 0 0 12px rgba(212, 175, 55, 0.3);
        }
        .nav-links a.current::before {
            transform: translate(-50%, -50%) scaleX(1);
            opacity: 1;
            animation: goldShine 2s linear infinite;
        }
        .nav-links a::after {
            content: '';
            position: absolute;
            bottom: -2px;
            left: 0;
            width: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--gold-bright), var(--gold-dark));
            transition: width 0.3s ease;
            box-shadow: 0 0 8px var(--gold-bright);
        }
        .nav-links a.current::after {
            width: 100%;
        }
        @keyframes goldShine {
            0% { background-position: 0% center; }
            100% { background-position: 200% center; }
        }

        /* 👑 スクリーンリーダー／クローラーのみに読ませる視覚的に隠すテキスト */
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        }

        /* ページ上部の見出しエリア（Heroの代わり） */
        .page-header {
            background-color: var(--navy-dark);
            color: var(--white);
            text-align: center;
            padding: 70px 20px 55px;
        }
        .page-header .blog-back {
            display: inline-block;
            margin-bottom: 20px;
            color: rgba(255, 255, 255, 0.6);
            font-size: 0.8rem;
            letter-spacing: 0.05em;
            text-decoration: none;
            transition: color 0.3s ease;
        }
        .page-header .blog-back:hover {
            color: var(--gold-bright);
        }
        .page-header .blog-date {
            color: var(--gold-bright);
            font-size: 0.85rem;
            font-weight: bold;
            letter-spacing: 0.15em;
            margin-bottom: 14px;
        }
        .page-header h1.article-title {
            font-size: 1.8rem;
            font-weight: 700;
            line-height: 1.6;
            max-width: 760px;
            margin: 0 auto;
        }

        /* 記事本文 */
        .article-body {
            max-width: 720px;
            margin: 0 auto;
        }
        .article-body > p {
            font-size: 1rem;
            line-height: 2;
            color: var(--text-color);
            margin-bottom: 28px;
        }
        .article-body h2 {
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.3rem;
            color: var(--navy-dark);
            border-bottom: 2px solid var(--gold-bright);
            padding-bottom: 12px;
            margin: 44px 0 20px;
        }
        .article-body h2:first-child {
            margin-top: 0;
        }
        .article-body .article-section p {
            font-size: 1rem;
            line-height: 2;
            color: var(--text-color);
            margin-bottom: 16px;
        }
        .article-body .article-section ul {
            list-style: none;
            margin-bottom: 16px;
        }
        .article-body .article-section ul li {
            position: relative;
            padding-left: 22px;
            line-height: 2;
            color: var(--text-color);
        }
        .article-body .article-section ul li::before {
            content: '\\25A0';
            position: absolute;
            left: 0;
            top: 0;
            color: var(--gold-bright);
            font-size: 0.7em;
            line-height: 2.4;
        }
        .article-body .sns-tag {
            color: var(--gold-dark);
            font-weight: bold;
            text-decoration: none;
        }
        .article-body .sns-tag:hover {
            text-decoration: underline;
        }
        .article-photo {
            margin: 0 0 28px;
            border: 1px solid rgba(10, 17, 40, 0.15);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
            overflow: hidden;
        }
        .article-photo img {
            width: 100%;
            height: auto;
            display: block;
        }
        .article-photo-caption {
            text-align: center;
            font-size: 0.8rem;
            color: var(--text-muted);
            margin: -18px 0 30px;
        }
        .article-cta {
            margin-top: 50px;
            padding: 35px 25px;
            text-align: center;
            background: linear-gradient(135deg, rgba(212, 175, 55, 0.08) 0%, rgba(212, 175, 55, 0.03) 100%);
            border: 1px solid rgba(212, 175, 55, 0.3);
        }
        .article-cta p {
            margin-bottom: 20px;
            font-weight: bold;
            color: var(--navy-dark);
        }
        .article-cta-buttons {
            display: flex;
            justify-content: center;
            align-items: center;
            flex-wrap: wrap;
            gap: 14px;
        }

        /* 大会公式LINEへの導線（faq.htmlと共通デザイン） */
        .faq-line-cta {
            position: relative;
            display: inline-flex;
            align-items: center;
            gap: 10px;
            margin-top: 28px;
            padding: 13px 30px;
            background: linear-gradient(135deg, var(--gold-bright) 0%, var(--gold-dark) 100%);
            color: var(--white) !important;
            text-decoration: none;
            font-weight: bold;
            letter-spacing: 0.05em;
            border: 1px solid rgba(255, 255, 255, 0.35);
            box-shadow: 0 4px 15px rgba(212, 175, 55, 0.35), 0 0 0 4px rgba(212, 175, 55, 0.08);
            animation: faqLineGlow 2.6s ease-in-out infinite;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .faq-line-cta:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 22px rgba(212, 175, 55, 0.5), 0 0 0 4px rgba(212, 175, 55, 0.12);
        }
        .faq-line-cta i {
            font-size: 1.3rem;
        }
        @keyframes faqLineGlow {
            0%, 100% { box-shadow: 0 4px 15px rgba(212, 175, 55, 0.35), 0 0 0 4px rgba(212, 175, 55, 0.08); }
            50% { box-shadow: 0 4px 22px rgba(212, 175, 55, 0.55), 0 0 0 7px rgba(212, 175, 55, 0.05); }
        }

        @media screen and (max-width: 1024px) {
            .page-header {
                padding: 50px 18px 40px;
            }
            .page-header h1.article-title {
                font-size: 1.4rem;
            }
            .article-body h2 {
                font-size: 1.1rem;
            }
        }
    </style>

    <!-- ==========================================
       👑 SEO対策：構造化データ（JSON-LD / schema.org Article）
       ========================================== -->
    <script type="application/ld+json">
    ${jsonLd}
    </script>
</head>
<body>

    <!-- 👑 オープニング演出：他ページと共通のrogo.png演出 -->
    <div id="introOverlay" class="intro-overlay">
        <div class="intro-inner">
            <img src="rogo.png" alt="Fantasista Cup ロゴ" class="intro-logo">
        </div>
    </div>
    <script>
        (function () {
            var overlay = document.getElementById('introOverlay');
            if (!overlay) return;
            var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (reduceMotion) {
                overlay.classList.add('intro-done');
            } else {
                var isTransition = false;
                try { isTransition = sessionStorage.getItem('fcPageTransition') === '1'; } catch (err) {}
                try { sessionStorage.removeItem('fcPageTransition'); } catch (err) {}

                document.documentElement.style.overflow = 'hidden';

                if (isTransition) {
                    var logo = overlay.querySelector('.intro-logo');
                    overlay.classList.add('intro-quick');
                    overlay.style.transition = 'none';
                    if (logo) logo.style.transition = 'none';
                    overlay.classList.add('intro-in');
                    void overlay.offsetWidth;
                    overlay.style.transition = '';
                    if (logo) logo.style.transition = '';
                    setTimeout(function () {
                        overlay.classList.add('intro-out');
                    }, 200);
                    setTimeout(function () {
                        overlay.classList.add('intro-done');
                        document.documentElement.style.overflow = '';
                    }, 700);
                } else {
                    requestAnimationFrame(function () {
                        requestAnimationFrame(function () {
                            overlay.classList.add('intro-in');
                        });
                    });
                    setTimeout(function () {
                        overlay.classList.add('intro-out');
                    }, 1700);
                    setTimeout(function () {
                        overlay.classList.add('intro-done');
                        document.documentElement.style.overflow = '';
                    }, 2700);
                }
            }

            document.addEventListener('click', function (e) {
                var link = e.target.closest('a[href]');
                if (!link || link.target === '_blank') return;
                var url;
                try {
                    url = new URL(link.href, window.location.href);
                } catch (err) {
                    return;
                }
                if (url.origin !== window.location.origin) return;
                if (url.pathname === window.location.pathname) return;
                if (!/\\.html$/i.test(url.pathname)) return;
                if (reduceMotion) return;

                e.preventDefault();
                try { sessionStorage.setItem('fcPageTransition', '1'); } catch (err) {}
                var targetHref = link.href;
                overlay.classList.add('intro-quick');
                overlay.classList.remove('intro-in', 'intro-out', 'intro-done');
                void overlay.offsetWidth;
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        overlay.classList.add('intro-in');
                    });
                });
                setTimeout(function () {
                    window.location.href = targetHref;
                }, 500);
            });
        })();
    </script>

    <!-- NAVIGATION -->
    <nav class="navbar">
        <div class="nav-container" style="padding: 8px 24px; max-width: 1400px; gap: 20px;">
            <div class="nav-brand">
                <a href="index.html" class="nav-logo" style="display: flex; align-items: center; gap: 14px; flex-shrink: 0;">
                    <img src="rogo.png" alt="Fantasista Cup ロゴ" style="height: 64px; width: auto; object-fit: contain; display: block; flex-shrink: 0;">
                    <span style="font-size: 1.4rem; letter-spacing: 0.08em; white-space: nowrap;">Fantasista Cup<span class="sr-only">（奈良県橿原市のサッカー大会）</span></span>
                </a>
            </div>
            <div class="nav-actions">
                <a href="https://www.instagram.com/fantasista.cup_nara/" target="_blank" rel="noopener noreferrer" class="nav-icon-btn" aria-label="Instagram">
                    <i class="fab fa-instagram"></i>
                </a>
                <a href="https://lin.ee/rGbe5tV" target="_blank" rel="noopener noreferrer" class="nav-icon-btn" aria-label="大会公式LINE">
                    <i class="fab fa-line"></i>
                </a>
                <button type="button" id="hamburgerBtn" class="hamburger-btn" aria-haspopup="true" aria-expanded="false" aria-controls="navOverlay" aria-label="メニューを開く">
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                    <span class="hamburger-line"></span>
                </button>
            </div>
        </div>
    </nav>

    <!-- 👑 ハンバーガーメニュー：全画面オーバーレイ -->
    <div id="navOverlay" class="nav-overlay">
        <button type="button" id="navOverlayClose" class="nav-overlay-close" aria-label="メニューを閉じる">
            <i class="fas fa-xmark"></i>
        </button>
        <div class="nav-overlay-inner">
            <div class="nav-group">
                <p class="nav-group-title">大会について</p>
                <ul class="nav-links">
                    <li><a href="index.html#concept">CONCEPT<span class="nav-link-sub">大会コンセプト</span></a></li>
                    <li><a href="index.html#entry">ENTRY<span class="nav-link-sub">大会エントリー</span></a></li>
                    <li><a href="index.html#terms">TERMS<span class="nav-link-sub">利用規約・参加規定</span></a></li>
                    <li><a href="index.html#sport-tabs">DISCIPLINES<span class="nav-link-sub">競技別ラインナップ</span></a></li>
                </ul>
            </div>
            <div class="nav-group">
                <p class="nav-group-title">大会記録</p>
                <ul class="nav-links">
                    <li><a href="blog.html" class="current">BLOG<span class="nav-link-sub">大会レポート</span></a></li>
                </ul>
            </div>
            <div class="nav-group">
                <p class="nav-group-title">採用・協賛</p>
                <ul class="nav-links">
                    <li><a href="staff.html">RECRUIT<span class="nav-link-sub">スタッフ募集</span></a></li>
                    <li><a href="sponsor.html">SPONSOR<span class="nav-link-sub">スポンサー募集</span></a></li>
                </ul>
            </div>
            <div class="nav-group">
                <p class="nav-group-title">サポート</p>
                <ul class="nav-links">
                    <li><a href="faq.html">Q&amp;A<span class="nav-link-sub">よくある質問</span></a></li>
                    <li><a href="index.html#contact">CONTACT<span class="nav-link-sub">お問い合わせ</span></a></li>
                    <li><a href="index.html#info">INFORMATION<span class="nav-link-sub">運営者情報</span></a></li>
                </ul>
            </div>
        </div>
    </div>

    <script>
        // 👑 ハンバーガーメニュー：開閉・スクロールロック・背景クリックとEscで閉じる
        (function () {
            const hamburgerBtn = document.getElementById('hamburgerBtn');
            const overlay = document.getElementById('navOverlay');
            const closeBtn = document.getElementById('navOverlayClose');
            if (!hamburgerBtn || !overlay) return;

            function openNavOverlay() {
                overlay.classList.add('open');
                hamburgerBtn.classList.add('active');
                hamburgerBtn.setAttribute('aria-expanded', 'true');
                document.documentElement.classList.add('nav-overlay-lock');
                document.body.classList.add('nav-overlay-lock');
            }
            function closeNavOverlay() {
                overlay.classList.remove('open');
                hamburgerBtn.classList.remove('active');
                hamburgerBtn.setAttribute('aria-expanded', 'false');
                document.documentElement.classList.remove('nav-overlay-lock');
                document.body.classList.remove('nav-overlay-lock');
            }
            window.closeNavOverlay = closeNavOverlay;

            hamburgerBtn.addEventListener('click', () => {
                if (overlay.classList.contains('open')) closeNavOverlay(); else openNavOverlay();
            });
            if (closeBtn) closeBtn.addEventListener('click', closeNavOverlay);
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeNavOverlay();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') closeNavOverlay();
            });
            overlay.querySelectorAll('.nav-links a').forEach(link => {
                link.addEventListener('click', closeNavOverlay);
            });
        })();
    </script>

    <main>
        <!-- PAGE HEADER -->
        <div class="page-header">
            <a href="blog.html" class="blog-back"><i class="fas fa-arrow-left"></i> BLOG一覧へ戻る</a>
            <p class="blog-date">${esc(data.dateDisplay)}</p>
            <h1 class="article-title">${esc(data.pageTitle)}</h1>
        </div>

        <!-- ARTICLE SECTION -->
        <section class="section">
            <div class="container">
                <div class="article-body">
${articleBodyHtml}
                </div>
            </div>
        </section>
    </main>

    <!-- FOOTER -->
    <footer class="footer">
        <ul class="footer-links">
            <li><a href="index.html#concept">CONCEPT</a></li>
            <li><a href="index.html#entry">ENTRY</a></li>
            <li><a href="blog.html">BLOG</a></li>
            <li><a href="index.html#terms">TERMS</a></li>
            <li><a href="index.html#sport-tabs">DISCIPLINES</a></li>
            <li><a href="staff.html">RECRUIT</a></li>
            <li><a href="sponsor.html">SPONSOR</a></li>
            <li><a href="index.html#contact">CONTACT</a></li>
            <li><a href="index.html#info">INFORMATION</a></li>
            <li><a href="faq.html">Q&amp;A</a></li>
        </ul>
        <div class="footer-brand">
            <img src="rogo.png" alt="Fantasista Cup ロゴ" class="footer-logo">
            <p class="footer-org">Fantasista Cup<span class="sr-only">運営事務局（奈良県橿原市のサッカー大会）</span></p>
        </div>
        <p>&copy; 2026 Fantasista Cup All Rights Reserved.</p>
        <p class="footer-legal-link"><a href="tokushoho.html">特定商取引法に基づく表記</a></p>
    </footer>
</body>
</html>
`;

// --- blog.html: Coming Soonカードの直後に新記事カードを挿入 ---
const blogListPath = path.join(ROOT, 'blog.html');
let blogHtml = readFileSync(blogListPath, 'utf8');

const newCard = `                    <a href="${slugFile}" class="blog-card">
                        <div class="blog-card-thumb">
                            <img src="${esc(data.ogImage)}" alt="${esc(data.ogImageAlt)}">
                        </div>
                        <div class="blog-card-body">
                            <p class="blog-card-date">${esc(data.dateDisplay)}</p>
                            <h2 class="blog-card-title">${esc(data.pageTitle)}</h2>
                            <p class="blog-card-excerpt">${esc(data.cardExcerpt)}</p>
                            <p class="blog-card-more">続きを読む <i class="fas fa-arrow-right"></i></p>
                        </div>
                    </a>

`;

const comingSoonCloseMarker = '                    </div>\n\n';
const comingSoonIdx = blogHtml.indexOf('blog-card-soon');
if (comingSoonIdx === -1) {
  console.error('blog.htmlに "blog-card-soon" が見つかりませんでした。手動で確認してください。');
  process.exit(1);
}
const insertAt = blogHtml.indexOf(comingSoonCloseMarker, comingSoonIdx);
if (insertAt === -1) {
  console.error('blog.htmlのComing Soonカード終端が想定した形式と違います。手動で確認してください。');
  process.exit(1);
}
const insertPos = insertAt + comingSoonCloseMarker.length;
const updatedBlogHtml = blogHtml.slice(0, insertPos) + newCard + blogHtml.slice(insertPos);

// --- sitemap.xml: 新記事のURLを追加し、/blogのlastmodを更新 ---
const sitemapPath = path.join(ROOT, 'sitemap.xml');
let sitemapXml = readFileSync(sitemapPath, 'utf8');
const siteBase = 'https://fantasista-cup.netlify.app';
const newUrlEntry = `    <url>
        <loc>${siteBase}/${data.slug}</loc>
        <lastmod>${data.dateISO}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.7</priority>
    </url>
</urlset>`;
sitemapXml = sitemapXml.replace('</urlset>', newUrlEntry);
sitemapXml = sitemapXml.replace(
  /(<loc>https:\/\/fantasista-cup\.netlify\.app\/blog<\/loc>\s*<lastmod>)[^<]+(<\/lastmod>)/,
  `$1${data.dateISO}$2`
);

if (dryRun) {
  console.log(`[dry-run] ${slugFile} を生成予定（書き込みはしません）`);
  console.log(reportHtml);
} else {
  writeFileSync(outPath, reportHtml, 'utf8');
  writeFileSync(blogListPath, updatedBlogHtml, 'utf8');
  writeFileSync(sitemapPath, sitemapXml, 'utf8');
  console.log(`✅ ${slugFile} を生成しました`);
  console.log('✅ blog.html に新記事カードを追加しました');
  console.log('✅ sitemap.xml を更新しました');
  console.log('\n次のステップ: git add / commit / push + netlify deploy --prod で公開してください。');
}
