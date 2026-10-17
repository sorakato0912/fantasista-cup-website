/**
 * Fantasista Cup 営業メール仕分け
 *
 * 【目的】スポンサー営業（問い合わせフォーム・営業メール）のあとに届くメールを、
 * 　　　　「フォームの自動返信（受付確認）」と「担当者からの返信」に分けてラベルを付ける。
 * 　　　　自動返信は受信トレイから外し（アーカイブ）、担当者の返信だけが受信トレイに残る。
 *
 * 【判定】引用部分（> で始まる行・「〜のメッセージ:」以降など）を除いた本文に
 * 　　　　「自動送信」「承りました」「以下の内容」などの定型文や、こちらがフォームに入力した
 * 　　　　電話番号・メールアドレス・ふりがながそのまま載っていれば自動返信とみなす。
 * 　　　　担当者が手で書いた返信は、引用を除くとこれらを含まないため「担当者の返信」になる。
 *
 * 【設置】（Chromeで行う。Safariだと認証画面で止まることがある）
 * 1. fantasista.cup.soccer@gmail.com でログインした状態で https://script.google.com/ を開く
 * 2. 「新しいプロジェクト」→ 名前を「FantasistaCup_メール仕分け」にする
 * 3. デフォルトのコードを全部消して、このファイルの中身を貼り付けて保存
 * 4. 上の関数選択で「setup」を選んで「実行」→ 権限の確認で「許可」
 * 　（「このアプリは確認されていません」→「詳細」→「安全ではないページに移動」→「許可」）
 * 　→ 過去30日分がその場で仕分けされ、以降は10分おきに自動で動く
 */

const LABEL_AUTO = '営業/🤖自動返信';
const LABEL_HUMAN = '営業/👤担当者返信';
const ME = 'fantasista.cup.soccer@gmail.com';

// 営業とは関係ない送信元（Google・GMOサイン・自社サイト・自分のアカウント・送信エラー）は仕分けない
const IGNORE_FROM = /google\.com|gmosign\.com|fantasista-cup\.com|sorakato0912@|footballforest\.kato@|mailer-daemon|postmaster/i;

// 自動返信に出てくる定型文・こちらがフォームに入力した値
const AUTO_MARKS = /自動送信|自動返信|自動配信|自動で(送|返|配)|自動的に|配信専用|送信専用|返信不要|受け?付け?(いた|致)?しました|受付ました|承りました|以下の(内容|通り)|下記の?(内容|通り)|入力内容|送信内容|内容の(ご)?確認|080-?2548-?1959|fantasista\.cup\.soccer@gmail\.com|かとう\s*そら|カトウ\s*ソラ/i;

// 引用の始まり（ここから下は先方が書いた文ではない）
const QUOTE_START = /^\s*(>|&gt;)|(wrote|より|のメッセージ|書きました)\s*[:：]\s*$|^-+\s*(Original Message|元のメッセージ)|^(From|差出人|送信者)\s*[:：]|\d{1,2}:\d{2}.*<[^>\s]+@[^>\s]+>.*[:：]\s*$|<fantasista\.cup\.soccer@gmail\.com>/i;

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sortMail').timeBased().everyMinutes(10).create();
  PropertiesService.getScriptProperties().setProperty('lastRun', String(Date.now() - 30 * 86400000));
  sortMail();
}

function sortMail() {
  const props = PropertiesService.getScriptProperties();
  const since = Number(props.getProperty('lastRun') || Date.now() - 86400000);
  const now = Date.now();
  const auto = GmailApp.getUserLabelByName(LABEL_AUTO) || GmailApp.createLabel(LABEL_AUTO);
  const human = GmailApp.getUserLabelByName(LABEL_HUMAN) || GmailApp.createLabel(LABEL_HUMAN);
  const days = Math.ceil((now - since) / 86400000) + 1;

  for (let start = 0; ; start += 100) {
    const threads = GmailApp.search(`newer_than:${days}d -from:me -in:spam -in:trash`, start, 100);
    for (const thread of threads) {
      const fresh = thread.getMessages().filter((m) => m.getDate().getTime() > since && !m.getFrom().includes(ME));
      if (fresh.length === 0) continue;
      const kinds = fresh.filter(isSalesMail).map(classify);
      if (kinds.includes('human')) {
        // 自動返信のあとに同じスレッドで担当者が返信してきた場合も、受信トレイに戻す
        thread.removeLabel(auto).addLabel(human).moveToInbox();
      } else if (kinds.includes('auto') && !thread.getLabels().some((l) => l.getName() === LABEL_HUMAN)) {
        thread.addLabel(auto).moveToArchive();
      }
    }
    if (threads.length < 100) break;
  }
  props.setProperty('lastRun', String(now));
}

// ponytail: 「加藤」宛てかどうかで営業関連と見なす簡易判定。チーム申込などが混ざるなら送信元の除外を増やす
function isSalesMail(message) {
  return !IGNORE_FROM.test(message.getFrom()) && /加藤|fantasista\s*cup/i.test(message.getPlainBody());
}

function classify(message) {
  // 送信元が no-reply でも電子契約の通知などは自動返信ではないので、送信元アドレスでは判定しない
  const body = message.getPlainBody();
  const autoHeader = /auto-replied/i.test(message.getHeader('Auto-Submitted'));
  if (!autoHeader && !AUTO_MARKS.test(ownText(body))) return 'human';
  // 会員登録・決済などのサービス通知にもこちらのメールアドレスは載るので、
  // 営業文（協賛のお願い）が控えとして載っているものだけを「営業の自動返信」とする
  return /協賛|スポンサー|盛り上げ/.test(body) ? 'auto' : null;
}

// 引用より上（先方が書いた部分）だけを返す
function ownText(body) {
  const lines = body.split(/\r?\n/);
  const cut = lines.findIndex((line) => QUOTE_START.test(line));
  return (cut === -1 ? lines : lines.slice(0, cut)).join('\n');
}
