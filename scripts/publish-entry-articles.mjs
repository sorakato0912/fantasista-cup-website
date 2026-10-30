#!/usr/bin/env node
// 「募集中」になった大会の参加チーム募集記事を、管理画面の大会データから自動で作る。
// 使い方: node scripts/publish-entry-articles.mjs [--dry-run] [--status 募集前]
//
// ・ステータスが「募集中」で、まだ記事のない大会ごとに scripts/report-data/entry-XXXXXXXX.json を作り、
//   generate-report.mjs で記事ページ・BLOG一覧・sitemap.xml に反映する（公開にはこのあとデプロイが必要）
// ・記事がすでにあるかどうかは、report-data 内のJSONの "tournamentId" で判定する
// ・--dry-run は書き込まずに内容を表示する。--status は確認用（例: 募集前の大会の記事を試しに作る）
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = path.join(ROOT, 'scripts', 'report-data');
const dryRun = process.argv.includes('--dry-run');
const statusArg = process.argv.indexOf('--status');
const targetStatus = statusArg === -1 ? '募集中' : process.argv[statusArg + 1];

// 公開用の接続情報は tournament-ld.js と同じものを使う（二重管理しない）
const ldSource = readFileSync(path.join(ROOT, 'tournament-ld.js'), 'utf8');
const SUPABASE_URL = ldSource.match(/SUPABASE_URL = "([^"]+)"/)[1];
const SUPABASE_ANON_KEY = ldSource.match(/SUPABASE_ANON_KEY = "([^"]+)"/)[1];

async function fetchRows(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${query}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`大会データを取得できません（${res.status}）: ${query}`);
  return res.json();
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const yen = (n) => `${Number(n).toLocaleString('ja-JP')}円`;
const hm = (time) => (time || '').slice(0, 5);

// 「〒639-2101　奈良県葛城市疋田301番～309番1」→ 都道府県・市区町村・それ以降
export function splitAddress(raw) {
  const address = (raw || '').replace(/〒\s*\d{3}-?\d{4}/, '').replace(/[\s　]+/g, '');
  const region = (address.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/) || [])[1] || '';
  const rest = address.slice(region.length);
  const locality = (rest.match(/^(.+?郡.+?[町村]|.+?[市区町村])/) || [])[1] || '';
  return { address, region, locality, street: rest.slice(locality.length) };
}

export function buildArticle(t, plans, today) {
  const [y, m, d] = t.event_date.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(`${t.event_date}T00:00:00Z`).getUTCDay()];
  const dateText = `${y}年${m}月${d}日（${weekday}）`;
  const timeText = t.event_end_time ? `${hm(t.event_start_time)}〜${hm(t.event_end_time)}` : `${hm(t.event_start_time)}〜`;
  const { address, region, locality, street } = splitAddress(t.venue_address);
  const place = `${region}${locality}`;
  const basePrice = t.entry_fee_max || t.entry_fee_min;
  const sport = t.sport_category || 'サッカー';
  const sportLabel = sport.endsWith('大会') ? sport : `${sport}大会`;
  const priceItems = plans.length
    ? plans.map((p) => ({ text: `参加費（${p.plan_name}）：1チーム ${yen(p.price)}` }))
    : basePrice ? [{ text: `参加費：1チーム ${yen(basePrice)}` }] : [];

  const blocks = [
    { type: 'p', text: `「${t.name}」の参加チーム募集を開始しました。${dateText}${hm(t.event_start_time)}〜、${place}の${t.venue}で開催します。本気で楽しめる舞台を用意して、みなさんのエントリーをお待ちしています。` },
    { type: 'h2', text: '大会概要' },
    { type: 'list', items: [
      { text: `日時：${dateText}${timeText}` },
      { text: `会場：${t.venue}（${place}）` },
      { text: `種目：${sport}` },
      ...(t.capacity ? [{ text: `定員：最大${t.capacity}チーム（先着順）` }] : []),
      ...priceItems,
    ] },
    ...(t.announcement_text ? [{ type: 'p', text: t.announcement_text }] : []),
    { type: 'h2', text: '会場・アクセス' },
    { type: 'list', items: [
      { text: `住所：${address}` },
      ...(t.venue_map_url ? [{ html: `地図：<a href="${t.venue_map_url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" target="_blank" rel="noopener noreferrer">Googleマップで見る</a>` }] : []),
    ] },
    { type: 'h2', text: 'Fantasista Cupについて' },
    { type: 'p', text: '「競技の質とエンジョイの精神が融合する、新たなサッカー大会」をコンセプトに、大人が本気で楽しめる舞台を奈良でつくっています。社会人チーム、草サッカーチーム、学生時代の仲間で組んだチームなど、本気で楽しみたいチームのご参加をお待ちしています。' },
    { type: 'h2', text: 'エントリー方法' },
    { type: 'p', text: `エントリーは「大会一覧を見る」からエントリーサイトにアクセスし、「${t.name}」を選んでお申し込みください。${t.capacity ? `定員の${t.capacity}チームに達し次第、受付を締め切ります。` : ''}お振込先や当日のご案内は大会公式LINEでお送りします。` },
    { type: 'cta', label: 'お問い合わせ', text: 'お問い合わせはこちら', href: 'index.html#contact' },
  ];

  const summary = `${dateText}${hm(t.event_start_time)}〜、${place}の${t.venue}で「${t.name}」を開催。${t.capacity ? `最大${t.capacity}チーム、` : ''}${basePrice ? `参加費${yen(basePrice)}。` : ''}エントリー受付中です。`;
  return {
    tournamentId: t.id,
    volume: t.name,
    slug: `blog-entry-${t.id.slice(0, 8)}`,
    dateISO: today,
    dateDisplay: today.replace(/-/g, '.'),
    pageTitle: `${t.name} 参加チーム募集｜${y}年${m}月${d}日・${place}の${sportLabel}`,
    metaDescription: summary,
    ogImage: 'recruit-cover.jpg',
    ogImageAlt: 'Fantasista Cup 参加チーム募集',
    cardExcerpt: summary,
    event: {
      name: t.name,
      startDate: `${t.event_date}T${t.event_start_time || '00:00:00'}+09:00`,
      ...(t.event_end_time ? { endDate: `${t.event_date}T${t.event_end_time}+09:00` } : {}),
      venue: t.venue,
      region,
      locality,
      street,
      price: basePrice,
    },
    blocks,
  };
}

async function main() {
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const published = new Set(
    readdirSync(DATA_DIR)
      .filter((f) => f.endsWith('.json') && !f.startsWith('TEMPLATE'))
      .map((f) => JSON.parse(readFileSync(path.join(DATA_DIR, f), 'utf8')).tournamentId)
      .filter(Boolean)
  );
  const tournaments = await fetchRows(
    `tournaments?select=*&status=eq.${encodeURIComponent(targetStatus)}&event_date=gte.${today}&order=event_date.asc`
  );
  const targets = tournaments.filter((t) => !published.has(t.id) && t.event_date && t.venue);
  console.log(`「${targetStatus}」の大会 ${tournaments.length}件 / うち記事がまだ無いもの ${targets.length}件`);

  for (const t of targets) {
    const plans = await fetchRows(`tournament_price_plans?select=plan_name,price&tournament_id=eq.${t.id}&order=sort_order.asc`);
    const article = buildArticle(t, plans, today);
    if (dryRun) {
      console.log(`\n[dry-run] ${article.slug}.html\n${JSON.stringify(article, null, 2)}`);
      continue;
    }
    const dataPath = path.join(DATA_DIR, `entry-${t.id.slice(0, 8)}.json`);
    writeFileSync(dataPath, `${JSON.stringify(article, null, 2)}\n`, 'utf8');
    const result = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-report.mjs'), dataPath], { stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`${article.slug} の生成に失敗しました`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}
