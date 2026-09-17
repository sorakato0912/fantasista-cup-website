/**
 * Fantasista Cup Threads自動投稿Bot
 *
 * 【目的】スプレッドシートに書いた投稿内容を、予定日時になったら自動でThreadsに投稿する。
 * 　　　　「意味のある投稿」を保つため、投稿するかどうかは必ず人（スプレッドシートの
 * 　　　　チェック）が決める設計にしている＝文章を自動生成してそのまま垂れ流すBotではない。
 *
 * ============================================================
 * 【STEP 1】Meta for DevelopersでThreads APIアプリを作る
 * ============================================================
 * 1. https://developers.facebook.com/ にログイン（Facebookアカウントが必要。なければ新規作成）
 * 2. 「マイアプリ」→「アプリを作成」
 *    ・アプリタイプ：「その他」→ 用途は「ビジネス」を選択
 *    ・アプリ名：例）FantasistaCup Threads連携
 * 3. 作成後のダッシュボードで「Threads API」のプロダクトを探して「セットアップ」を押す
 * 4. Threads API設定画面の中に「Threadsアカウントを追加（テスター登録）」のような項目があるので、
 *    FantasistaCupのThreadsアカウントのユーザー名を追加する
 * 5. スマホのThreadsアプリ側で、招待の承認が必要になるはず
 *    （設定 → アカウント → 招待中のアプリ、のような場所。文言はMeta側の仕様変更で変わることがあるので、
 *    　見つからなければ画面のスクリーンショットを見せてください）
 * 6. Threads API設定画面に表示される「アプリID」「アプリシークレット」を控える
 *    👉 これらはこのチャット（Claude）には貼らず、STEP3でGoogleの画面に直接入力してください
 *
 * ============================================================
 * 【STEP 2】このスクリプトをApps Scriptプロジェクトに設置する
 * ============================================================
 * 1. fantasista.cup.soccer@gmail.com でログインした状態で https://script.google.com/ を開く
 * 2. 「新しいプロジェクト」を作成（プロジェクト名は「FantasistaCup_Threads」など）
 * 3. デフォルトのコードを全部消して、このファイルの中身を貼り付けて保存
 *
 * ============================================================
 * 【STEP 3】トークンをスクリプト プロパティに設定する
 * ============================================================
 * 左メニューの歯車アイコン「プロジェクトの設定」→ 一番下「スクリプト プロパティ」→ 追加
 *    ・THREADS_APP_ID       値：STEP1で控えたアプリID
 *    ・THREADS_APP_SECRET   値：STEP1で控えたアプリシークレット
 * （THREADS_SHEET_ID・THREADS_ACCESS_TOKEN・THREADS_USER_IDは後のSTEPで自動的に追加されます）
 *
 * ============================================================
 * 【STEP 4】Webアプリとしてデプロイする
 * ============================================================
 * 1. 右上「デプロイ」→「新しいデプロイ」→ 種類の選択で「ウェブアプリ」を選ぶ
 * 2. 「アクセスできるユーザー」は必ず「全員」にする
 * 3. 「デプロイ」→ 初回は権限承認画面が出るので許可する
 * 4. 発行された「ウェブアプリのURL」をコピー
 * 5. STEP1のMetaアプリ設定画面に戻り、「Threads API」→ OAuthのリダイレクトURI（Redirect URI）
 *    という欄にこのURLを貼って保存する
 *
 * ============================================================
 * 【STEP 5】Threadsアカウントと連携する（認証）
 * ============================================================
 * 1. Apps Scriptエディタで関数選択を getAuthUrl にして「実行」ボタンを押す
 * 2. 実行ログ（表示 → ログ）に表示されたURLをコピーして、ブラウザで開く
 * 3. Threadsの認可画面が出るので「許可」する
 * 4. 自動でWebアプリのURLにリダイレクトされ、「✅ 連携完了！」と表示されればOK
 *    （このときTHREADS_ACCESS_TOKENとTHREADS_USER_IDが自動でスクリプトプロパティに保存される）
 *
 * ============================================================
 * 【STEP 6】投稿キュー用のスプレッドシートを作る
 * ============================================================
 * 1. 新しいGoogleスプレッドシートを作成（fantasista.cup.soccer@gmail.comで）
 * 2. 1行目に見出しを入れる：
 *    A1:投稿する  B1:予定日時  C1:本文  D1:画像URL（任意）  E1:ステータス  F1:投稿後リンク  G1:メモ（種別など）
 * 3. 2行目以降に投稿したい内容を書いていく
 *    ・A列は投稿してよいものだけチェックボックス（データの入力規則でチェックボックスにすると安全）
 *    ・B列は「2026/09/20 12:00」のような日時
 *    ・E列・F列はスクリプトが自動で書き込むので空欄でOK
 * 4. スプレッドシートのURLから、/d/ と /edit の間にあるID文字列をコピー
 * 5. Apps Scriptのスクリプトプロパティに THREADS_SHEET_ID として追加
 *
 * ============================================================
 * 【STEP 7】定期実行トリガーを設定する
 * ============================================================
 * 左メニューの時計アイコン「トリガー」→「トリガーを追加」を2つ設定
 *    ① checkAndPostQueue を「時間主導型」→「時間ベースのタイマー」→ 30分おき
 *    ② refreshThreadsToken を「時間主導型」→「月ベースのタイマー」→ 1日1回など月1回以上
 *      （長期トークンは60日で失効するため、定期的に更新し続ける）
 *
 * これで、スプレッドシートの「投稿する」にチェックを入れて予定日時を過ぎれば自動投稿される。
 * 逆に言うと、チェックを入れない限り何も投稿されない＝意味のない自動生成投稿の垂れ流しにはならない。
 */

// 👑 デバッグ用：実行数のログ画面が使えない時に、URLへアクセスするだけで
//    最後の実行結果を確認できるようにする。 https://.../exec?debug=threads_log で閲覧可能
function doGet(e) {
  if (e && e.parameter && e.parameter.debug === 'threads_log') {
    var log = PropertiesService.getScriptProperties().getProperty('LAST_DEBUG_LOG') || '(まだログがありません)';
    return ContentService.createTextOutput(log);
  }
  if (e && e.parameter && e.parameter.code) {
    return handleOAuthCallback(e.parameter.code);
  }
  return ContentService.createTextOutput('OK');
}

function saveDebugLog(text) {
  var stamped = new Date().toISOString() + '\n' + text;
  PropertiesService.getScriptProperties().setProperty('LAST_DEBUG_LOG', stamped);
  Logger.log(stamped);
}

/**
 * STEP5で実行する関数。実行ログに認可用URLを出力する。
 */
function getAuthUrl() {
  var props = PropertiesService.getScriptProperties();
  var appId = props.getProperty('THREADS_APP_ID');
  if (!appId) {
    Logger.log('THREADS_APP_IDが未設定です。先にSTEP3を完了してください。');
    return;
  }
  var redirectUri = ScriptApp.getService().getUrl();
  var url = 'https://threads.net/oauth/authorize'
    + '?client_id=' + encodeURIComponent(appId)
    + '&redirect_uri=' + encodeURIComponent(redirectUri)
    + '&scope=threads_basic,threads_content_publish'
    + '&response_type=code';
  Logger.log(url);
}

/**
 * Threadsからのリダイレクト（?code=...）を受け取り、トークンを保存する
 */
function handleOAuthCallback(code) {
  var props = PropertiesService.getScriptProperties();
  var appId = props.getProperty('THREADS_APP_ID');
  var appSecret = props.getProperty('THREADS_APP_SECRET');
  var redirectUri = ScriptApp.getService().getUrl();

  var shortRes = UrlFetchApp.fetch('https://graph.threads.net/oauth/access_token', {
    method: 'post',
    payload: {
      client_id: appId,
      client_secret: appSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code: code
    },
    muteHttpExceptions: true
  });
  var shortJson = JSON.parse(shortRes.getContentText());
  saveDebugLog('短命トークン取得: ' + shortRes.getResponseCode() + ' ' + shortRes.getContentText());
  if (!shortJson.access_token) {
    return ContentService.createTextOutput('トークン取得に失敗しました。?debug=threads_logでログを確認してください。');
  }

  var longRes = UrlFetchApp.fetch(
    'https://graph.threads.net/access_token?grant_type=th_exchange_token'
      + '&client_secret=' + encodeURIComponent(appSecret)
      + '&access_token=' + encodeURIComponent(shortJson.access_token),
    { muteHttpExceptions: true }
  );
  var longJson = JSON.parse(longRes.getContentText());
  saveDebugLog('長期トークン取得: ' + longRes.getResponseCode() + ' ' + longRes.getContentText());
  if (!longJson.access_token) {
    return ContentService.createTextOutput('長期トークンへの交換に失敗しました。?debug=threads_logでログを確認してください。');
  }

  props.setProperty('THREADS_ACCESS_TOKEN', longJson.access_token);
  var expiresAt = new Date(Date.now() + (longJson.expires_in || 5184000) * 1000);
  props.setProperty('THREADS_TOKEN_EXPIRES_AT', expiresAt.toISOString());

  var meRes = UrlFetchApp.fetch(
    'https://graph.threads.net/v1.0/me?fields=id,username&access_token=' + encodeURIComponent(longJson.access_token)
  );
  var meJson = JSON.parse(meRes.getContentText());
  if (meJson.id) {
    props.setProperty('THREADS_USER_ID', String(meJson.id));
  }

  return ContentService.createTextOutput(
    '✅ 連携完了！\nユーザー: ' + (meJson.username || '不明') + '\nID: ' + (meJson.id || '不明')
      + '\n\nこのタブは閉じてOKです。'
  );
}

/**
 * 長期トークンをリフレッシュする（60日で失効するため、月1回以上実行するトリガーを設定すること）
 */
function refreshThreadsToken() {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('THREADS_ACCESS_TOKEN');
  if (!token) {
    saveDebugLog('リフレッシュ対象のトークンがありません。先にSTEP5を完了してください。');
    return;
  }

  var res = UrlFetchApp.fetch(
    'https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=' + encodeURIComponent(token),
    { muteHttpExceptions: true }
  );
  var json = JSON.parse(res.getContentText());
  saveDebugLog('トークンリフレッシュ: ' + res.getResponseCode() + ' ' + res.getContentText());
  if (json.access_token) {
    props.setProperty('THREADS_ACCESS_TOKEN', json.access_token);
    var expiresAt = new Date(Date.now() + (json.expires_in || 5184000) * 1000);
    props.setProperty('THREADS_TOKEN_EXPIRES_AT', expiresAt.toISOString());
  }
}

/**
 * STEP7のトリガー①で30分おきに実行する。
 * スプレッドシートを見て「投稿する」にチェックがあり、予定日時を過ぎていて、まだ未投稿の行だけ投稿する。
 */
function checkAndPostQueue() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('THREADS_SHEET_ID');
  if (!sheetId) {
    saveDebugLog('THREADS_SHEET_IDが未設定です。先にSTEP6を完了してください。');
    return;
  }

  var sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  var data = sheet.getDataRange().getValues();
  var now = new Date();

  for (var i = 1; i < data.length; i++) { // 1行目は見出しなのでスキップ
    var row = data[i];
    var approved = row[0];
    var scheduledAt = row[1];
    var text = row[2];
    var imageUrl = row[3];
    var status = row[4];

    if (!approved) continue; // チェックが入っていない行は無視＝人が承認したものだけ投稿
    if (status === '投稿済み') continue;
    if (!text) continue;

    var scheduledDate = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() > now.getTime()) continue;

    var result = postToThreads(text, imageUrl);
    var rowIndex = i + 1;
    if (result.success) {
      sheet.getRange(rowIndex, 5).setValue('投稿済み');
      sheet.getRange(rowIndex, 6).setValue(result.postId || '');
    } else {
      sheet.getRange(rowIndex, 5).setValue('エラー');
      sheet.getRange(rowIndex, 6).setValue(result.error || '');
    }
  }
}

/**
 * 実際にThreadsへ投稿する（コンテナ作成 → 公開の2段階）
 */
function postToThreads(text, imageUrl) {
  var props = PropertiesService.getScriptProperties();
  var token = props.getProperty('THREADS_ACCESS_TOKEN');
  var userId = props.getProperty('THREADS_USER_ID');
  if (!token || !userId) {
    return { success: false, error: 'トークンまたはユーザーIDが未設定（STEP5未完了）' };
  }

  var containerParams = { access_token: token, text: text };
  if (imageUrl) {
    containerParams.media_type = 'IMAGE';
    containerParams.image_url = imageUrl;
  } else {
    containerParams.media_type = 'TEXT';
  }

  var createRes = UrlFetchApp.fetch(
    'https://graph.threads.net/v1.0/' + userId + '/threads?' + toQueryString(containerParams),
    { method: 'post', muteHttpExceptions: true }
  );
  var createJson = JSON.parse(createRes.getContentText());
  saveDebugLog('コンテナ作成: ' + createRes.getResponseCode() + ' ' + createRes.getContentText());
  if (!createJson.id) {
    return { success: false, error: 'コンテナ作成失敗: ' + createRes.getContentText() };
  }

  Utilities.sleep(3000); // 画像取得などThreads側の処理待ち

  var publishRes = UrlFetchApp.fetch(
    'https://graph.threads.net/v1.0/' + userId + '/threads_publish?'
      + toQueryString({ access_token: token, creation_id: createJson.id }),
    { method: 'post', muteHttpExceptions: true }
  );
  var publishJson = JSON.parse(publishRes.getContentText());
  saveDebugLog('公開: ' + publishRes.getResponseCode() + ' ' + publishRes.getContentText());
  if (!publishJson.id) {
    return { success: false, error: '公開失敗: ' + publishRes.getContentText() };
  }

  return { success: true, postId: publishJson.id };
}

function toQueryString(params) {
  return Object.keys(params).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
}
