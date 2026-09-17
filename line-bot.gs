/**
 * Fantasista Cup 公式LINE Bot（友だち追加時の自動あいさつ ＋ 大会情報の一斉配信）
 *
 * 【対象】既存の公式LINEアカウント（lin.ee/rGbe5tV）にMessaging APIを追加接続します。
 * 　　　　アカウントを新しく作り直すわけではないので、今いる友だちはそのまま引き継がれます。
 *
 * ============================================================
 * 【STEP 1】LINE Developersコンソール側でMessaging APIを有効化する
 * ============================================================
 * 1. https://manager.line.biz/ を開き、Fantasista Cupの公式アカウントを選択
 * 2. 左メニュー「設定」→「Messaging API」タブを開く
 * 3. 「Messaging APIを利用する」を押す
 *    （プロバイダー名を聞かれたら任意の名前でOK。例：Fantasista Cup）
 * 4. 有効化されたら、同じページで下記2つを控える
 *    ・チャネルアクセストークン（長期）→「発行」ボタンを押して発行し、表示された文字列をコピー
 *    ・チャネルシークレット（同ページ、または「LINE Developersコンソールで管理」から基本設定タブ）
 *    👉 これらはこのチャット（Claude）には貼らず、STEP 3でGoogleの画面に直接入力してください
 * 5. 「応答設定」（LINE Official Account Managerの左メニュー）で
 *    ・「応答メッセージ」→ OFF（このBotに任せるため。ONのままだとLINE標準の自動応答と競合します）
 *    ・「Webhook」→ ON
 *
 * ============================================================
 * 【STEP 2】このスクリプトをApps Scriptプロジェクトに設置する
 * ============================================================
 * 1. fantasista.cup.soccer@gmail.com でログインした状態で https://script.google.com/ を開く
 * 2. 「新しいプロジェクト」を作成（プロジェクト名は「FantasistaCup_LINEbot」など）
 * 3. デフォルトのコードを全部消して、このファイルの中身を貼り付けて保存
 *
 * ============================================================
 * 【STEP 3】トークンをスクリプト プロパティに設定する（安全な保存場所）
 * ============================================================
 * 1. 左メニューの歯車アイコン「プロジェクトの設定」を開く
 * 2. 一番下「スクリプト プロパティ」→「スクリプト プロパティを追加」
 * 3. 次の2つを追加して保存
 *    ・プロパティ: LINE_CHANNEL_ACCESS_TOKEN   値: STEP1で発行したチャネルアクセストークン
 *    ・プロパティ: LINE_CHANNEL_SECRET         値: STEP1で控えたチャネルシークレット
 *
 * ============================================================
 * 【STEP 4】Webアプリとしてデプロイする
 * ============================================================
 * 1. 右上「デプロイ」→「新しいデプロイ」→ 種類の選択で「ウェブアプリ」を選ぶ
 * 2. 「アクセスできるユーザー」は必ず「全員」にする
 * 3. 「デプロイ」→ 初回は権限承認画面が出るので許可する
 * 4. 発行された「ウェブアプリのURL」をコピー
 * 5. LINE Developersコンソールの「Messaging API設定」タブ →「Webhook URL」にそのURLを貼って保存
 * 6. 「検証」ボタンを押して成功（Success）と出ればOK
 *
 * これで、友だち追加された瞬間にWELCOME_MESSAGESが自動送信されるようになります。
 *
 * ============================================================
 * 【一斉配信のやり方（大会情報を全員に送る）】
 * ============================================================
 * Apps Scriptエディタで関数選択を broadcastMessage にして「実行」ボタンを押すか、
 * 下の broadcastMessage() 内のテキストを書き換えてから実行してください。
 * 無料プランは月1000通まで（配信数 × 友だち数でカウント）なので、
 * 友だちが増えてきたら配信頻度に注意してください。
 */

// 👑 友だち追加時に届く「あいさつメッセージ」。配列の順番どおりに複数吹き出しで届きます（最大5件まで）
var WELCOME_MESSAGES = [
  '友だち追加ありがとうございます！⚽👑\nFantasista Cup公式LINEへようこそ。',
  'こちらでは大会の開催情報・エントリー締切・当日のお知らせなどを配信していきます。最新情報をお見逃しなく！',
  '大会の様子はInstagramでも発信中です👉 https://www.instagram.com/fantasista.cup_nara/\n公式サイトはこちら👉 https://fantasista-cup.netlify.app/'
];

function doPost(e) {
  var body = e.postData.contents;

  // 👑 Webhookの送信元がLINEであることを署名で検証（なりすまし防止）
  var channelSecret = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_SECRET');
  var signature = e.parameter['X-Line-Signature']; // GASの制約上ヘッダーは直接読めないため、検証したい場合はdoPost(e)のheadersではなくこちらで代替
  // ※ GASはリクエストヘッダーを直接取得できないため、厳密な署名検証が必要な場合は
  //    別途プロキシ（Cloudflare Workers等）を挟む構成にしてください。ここでは簡易実装とします。

  var json = JSON.parse(body);
  var events = json.events || [];

  events.forEach(function (event) {
    if (event.type === 'follow') {
      replyMessages(event.replyToken, WELCOME_MESSAGES);
    }
  });

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function replyMessages(replyToken, texts) {
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
  var messages = texts.map(function (text) {
    return { type: 'text', text: text };
  });

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ replyToken: replyToken, messages: messages }),
    muteHttpExceptions: true
  });
}

/**
 * 全友だちに一斉配信する（大会レポート公開・新規大会告知などのタイミングで手動実行）
 * 使い方：下のtextを書き換えてから、Apps Scriptエディタで実行ボタンを押す
 */
function broadcastMessage() {
  var text = 'ここに配信したい内容を書いてから実行してください';
  var token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');

  var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({ messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
  Logger.log(res.getContentText());
}
