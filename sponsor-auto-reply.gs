/**
 * Fantasista Cup スポンサー問い合わせ 自動返信Bot
 *
 * 【役割】サイトのお問い合わせフォームで「取材・協賛のご相談」を選んで送信された時、
 * 　　　　Netlify Functions（submission-created.js）経由でこのスクリプトが呼ばれ、
 * 　　　　協賛提案資料（PDF）を添付した自動返信メールを即座に送信する。
 * 　　　　あわせて運営宛にも「スポンサー相談が来た」ことが分かる通知メールを送る。
 *
 * ============================================================
 * 【STEP 1】Apps Scriptプロジェクトを作成する
 * ============================================================
 * 1. fantasista.cup.soccer@gmail.com でログインした状態で https://script.google.com/ を開く
 * 2. 「新しいプロジェクト」を作成し、名前を「FantasistaCup_SponsorAutoReply」にする
 * 3. デフォルトのコードを全部消して、このファイルの中身を貼り付けて保存
 *    （チャットのコードブロックから直接コピペするとエラーが起きやすいので、
 * 　　このファイルをテキストエディットで開いてコピーするのがおすすめです）
 *
 * ============================================================
 * 【STEP 2】スクリプト プロパティを設定する
 * ============================================================
 * 歯車アイコン「プロジェクトの設定」→「スクリプト プロパティ」に以下を追加：
 *   ・プロパティ: WEBHOOK_SECRET
 *   ・値        : 3b30435878aeb027cb71f32380bdc0276a92332b962e59f7
 *     （このBotだけが受け付ける合言葉。Netlify側にも同じ値を設定済みです）
 *
 * ============================================================
 * 【STEP 3】Webアプリとしてデプロイする
 * ============================================================
 * 1. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」を選ぶ
 * 2. 「アクセスできるユーザー」は必ず「全員」にする
 * 3. 「デプロイ」→ 初回は権限承認画面が出るので許可する
 * 4. 発行された「ウェブアプリのURL」をコピーしてClaudeに伝える
 *    （このURL自体は秘密情報ではないので、チャットに貼って大丈夫です）
 */

var PDF_URL = 'https://fantasista-cup.com/fantasista-cup-sponsorship-proposal.pdf';
var ADMIN_EMAIL = 'fantasista.cup.soccer@gmail.com';
var REPLY_SUBJECT = 'Fantasista Cupへのスポンサーご相談ありがとうございます';

function buildReplyBody(name) {
  return name + ' 様\n\n' +
    'この度はFantasista Cupへのスポンサー・協賛のご相談をいただき、誠にありがとうございます。\n' +
    '協賛プランの詳細資料を添付いたしますので、ご確認いただけますと幸いです。\n\n' +
    'ご不明点やご要望がございましたら、このメールにそのままご返信いただくか、下記までお気軽にご連絡ください。\n\n' +
    '────────────────────\n' +
    'Fantasista Cup\n' +
    '代表：加藤 大空\n' +
    '電話：080-2548-1959\n' +
    'メール：fantasista.cup.soccer@gmail.com\n' +
    '────────────────────\n';
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');

    if (!secret || body.secret !== secret) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'forbidden' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var name = body.name || 'ご担当者';
    var email = body.email;

    if (!email) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'no-email' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var pdfBlob = UrlFetchApp.fetch(PDF_URL).getBlob().setName('Fantasista_Cup_協賛提案.pdf');

    MailApp.sendEmail({
      to: email,
      subject: REPLY_SUBJECT,
      body: buildReplyBody(name),
      attachments: [pdfBlob],
      name: 'Fantasista Cup 運営事務局'
    });

    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: '🔥【スポンサー相談】' + name + '様より問い合わせ',
      body: '自動返信（PDF添付）を送信済みです。\n\n名前: ' + name + '\nメール: ' + email +
        '\nメッセージ: ' + (body.message || '(なし)')
    });

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
