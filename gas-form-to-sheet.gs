/**
 * Fantasista Cup CONTACTフォーム → スプレッドシート自動記入 ＋ 定員集計API
 *
 * 【使い方】
 * 1. fantasista.cup.soccer@gmail.com でログインした状態で、
 *    Google Sheetsで新規スプレッドシートを作成し、名前を「FantasistaCup_申込管理」にする
 * 2. メニュー「拡張機能」→「Apps Script」を開く
 * 3. デフォルトで入っているコードを全部消して、このファイルの中身を貼り付けて保存
 * 4. 右上「デプロイ」→「新しいデプロイ」→ 種類の選択で「ウェブアプリ」を選ぶ
 * 5. 「アクセスできるユーザー」は必ず「全員」にする（これがないとサイトから読み書きできません）
 * 6. 「デプロイ」を押す → 初回はGoogleの権限承認画面が出るので許可する
 * 7. 発行された「ウェブアプリのURL」（https://script.google.com/macros/s/.../exec）を控えておく
 * 8. そのURLを教えてもらえれば、サイト側のコードに組み込みます
 *
 * 【定員（満員）の考え方】
 * 「問い合わせ内容／エントリー希望大会」列が指定イベント名（例：Vol.3）と完全一致する行数を
 * 「本申込」としてカウントします。「Vol.3（キャンセル待ち）」のように末尾に(キャンセル待ち)が付いた
 * 行は定員カウントに含めません（サイト側が満員後、自動でこの値を送るようにします）。
 */

var MAX_TEAMS = 5; // 大会の定員（チーム数）
var LINE_URL = 'https://lin.ee/rGbe5tV'; // 大会公式LINE

// 👑 週次の整合性チェック用設定
var CURRENT_EVENT = 'Vol.3'; // 現在募集中の大会名。次回大会に切り替わったらここを書き換えるだけでOK
var NOTIFY_EMAIL = 'fantasista.cup.soccer@gmail.com'; // ズレ検出時の通知先
// このスクリプトを「新しいデプロイ」し直してURLが変わった場合は、下記もサイト側(index.html)のGAS_WEB_APP_URLと
// 必ず同じ値に揃えてください
var GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzlACo3huDQRTWLQKS1NNa6aqIBoVshlj8aOJaJfMCb4_kCC5jekR1pz2alrR_Rdew_/exec';

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  // 1行目が空ならヘッダー行を自動で作成
  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      '送信日時',
      'チーム名',
      '代表者氏名',
      'メールアドレス',
      '問い合わせ内容／エントリー希望大会',
      'お問い合わせ内容',
      '代表者電話番号',
      '大会公式LINE追加状況',
      '過去大会参加経験'
    ]);
  }

  var params = e.parameter;
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');

  sheet.appendRow([
    timestamp,
    params['team-name'] || '',
    params['name'] || '',
    params['email'] || '',
    params['select-event'] || '',
    params['message'] || '',
    params['phone'] || '',
    params['line-status'] || '',
    params['past-participation'] || ''
  ]);

  // メール送信に失敗しても、スプレッドシートへの記入は必ず残す（try/catchで分離）
  try {
    sendConfirmationEmail(params);
  } catch (err) {
    Logger.log('自動返信メール送信エラー: ' + err);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 送信直後の自動返信メール。
 * 「その他」のお問い合わせと「キャンセル待ち」申込は、内容を分けて送信する。
 */
function sendConfirmationEmail(params) {
  var toEmail = params['email'];
  if (!toEmail) return;

  var teamName = params['team-name'] || '';
  var repName = params['name'] || '';
  var eventName = params['select-event'] || '';
  var isWaitlist = eventName.indexOf('キャンセル待ち') !== -1;
  var isOtherInquiry = eventName === 'その他';

  var subject, body;

  if (isOtherInquiry) {
    // ただの質問・問い合わせ用（振込案内は不要）
    subject = '【Fantasista Cup】お問い合わせを受け付けました';
    body =
      repName + ' 様\n\n' +
      'この度はFantasista Cupへお問い合わせいただき、誠にありがとうございます。\n' +
      '以下の内容で受付いたしました。内容を確認のうえ、運営事務局より折り返しご連絡いたします。\n\n' +
      '・お問い合わせ内容：\n' + (params['message'] || '') + '\n\n' +
      '─────────────────────\n\n' +
      '大会に関する最新情報は公式LINEでも配信しております。よろしければご登録をお願いいたします。\n' +
      LINE_URL + '\n\n' +
      'Fantasista Cup 運営事務局\n' +
      'fantasista.cup.soccer@gmail.com';

  } else if (isWaitlist) {
    // 定員到達後のキャンセル待ち登録用（振込案内はまだ不要）
    subject = '【Fantasista Cup】キャンセル待ち登録を受け付けました（' + eventName + '）';
    body =
      repName + ' 様\n\n' +
      'この度はFantasista Cup「' + eventName + '」へお申し込みいただき、誠にありがとうございます。\n' +
      '大変申し訳ございませんが、現在定員に達しているため、キャンセル待ちとして受付いたしました。\n\n' +
      '・チーム名：' + teamName + '\n' +
      '・代表者氏名：' + repName + '\n\n' +
      '繰り上げでご参加いただける枠が出た場合、こちらのメールアドレス宛にご連絡いたします。\n\n' +
      '─────────────────────\n\n' +
      '大会に関する最新情報・繰り上げのご連絡は公式LINEでも配信しております。\n' +
      'まだ追加されていない方は、下記より必ずご登録をお願いいたします。\n\n' +
      LINE_URL + '\n\n' +
      'Fantasista Cup 運営事務局\n' +
      'fantasista.cup.soccer@gmail.com';

  } else {
    // 通常の大会エントリー用（振込案内はLINE側で個別に送るため、メールには含めない）
    subject = '【Fantasista Cup】お申し込みありがとうございます（' + eventName + '）';
    body =
      repName + ' 様\n\n' +
      'この度はFantasista Cup「' + eventName + '」にお申し込みいただき、誠にありがとうございます。\n' +
      '以下の内容で受付いたしました。\n\n' +
      '・チーム名：' + teamName + '\n' +
      '・代表者氏名：' + repName + '\n' +
      '・エントリー大会：' + eventName + '\n\n' +
      '─────────────────────\n' +
      '■ 大会公式LINEのご登録を必ずお願いします\n' +
      '─────────────────────\n' +
      '参加費振込先のご案内・日程確定・大会直前のリマインドは、すべて大会公式LINEにて個別にお送りいたします。\n' +
      'まだ追加されていない方は、下記より今すぐご登録をお願いいたします。\n\n' +
      LINE_URL + '\n\n' +
      '─────────────────────\n' +
      '■ キャンセル規定について\n' +
      '─────────────────────\n' +
      '・無料期間：大会開催日「22日前12:00（昼）」まで\n' +
      '・上記期限を過ぎてのキャンセルは、理由の如何に関わらず参加費全額（100%）が発生いたします\n' +
      '・無断キャンセルの場合は、違約金（参加費全額）を即時請求させていただきます\n\n' +
      'あらかじめご了承のうえ、お申し込みくださいますようお願いいたします。\n\n' +
      '─────────────────────\n\n' +
      'ご不明点がございましたら、上記公式LINEまでお気軽にご連絡ください。\n\n' +
      '今後ともFantasista Cupをよろしくお願いいたします。\n\n' +
      'Fantasista Cup 運営事務局\n' +
      'fantasista.cup.soccer@gmail.com';
  }

  GmailApp.sendEmail(toEmail, subject, body, { name: 'Fantasista Cup 運営事務局' });
}

/**
 * 例：/exec?event=Vol.3&callback=xxx へのGETで、その大会の申込状況をJSONPで返す
 * （GASのWebアプリはCORSヘッダーを返さずfetch()では読み取れないため、JSONP形式にしている）
 * → xxx({ event: "Vol.3", count: 3, max: 5, remaining: 2, full: false })
 */
function doGet(e) {
  var eventName = (e.parameter && e.parameter.event) || '';
  var callback = e.parameter && e.parameter.callback;
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();

  var count = 0;
  if (eventName && lastRow > 1) {
    // E列（5列目）が「問い合わせ内容／エントリー希望大会」
    var values = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === eventName) count++;
    }
  }

  var remaining = Math.max(0, MAX_TEAMS - count);

  var result = {
    event: eventName,
    count: count,
    max: MAX_TEAMS,
    remaining: remaining,
    full: count >= MAX_TEAMS
  };

  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 👑 週次データ整合性チェック（トリガーで毎週月曜15:00頃に自動実行）
 *
 * 「実際の数」＝このスクリプト内でスプレッドシートを直接数え直した、独立した集計結果
 * 「サイトの数」＝実際に一般公開されているウェブアプリURL（doGet）を外部から叩いて得た結果
 * の2つを突き合わせます。同じ関数を2回呼ぶのではなく、あえて「本番で実際に動いているエンドポイント」
 * を外側から検証することで、デプロイし忘れ（コードは直したのに公開URLが古いバージョンのまま等）や
 * ウェブアプリ側の不具合・応答不能も検知できるようにしています。
 *
 * 一致していれば何もしません（通知なし＝正常）。ズレている場合、またはサイト側に正常に
 * アクセスできなかった場合のみ、NOTIFY_EMAIL 宛にアラートメールを送信します。
 */
function weeklyIntegrityCheck() {
  var actualCount = countActualEntries_(CURRENT_EVENT);
  var siteResult = fetchSiteCount_(CURRENT_EVENT);

  // 手動テスト時に「実行数」ログで結果を確認できるよう、必ず記録しておく
  Logger.log('weeklyIntegrityCheck: event=' + CURRENT_EVENT + ', actualCount=' + actualCount + ', siteResult=' + JSON.stringify(siteResult));

  // サイト側から正常に数値を取得できなかった場合も「ズレ」として扱い、必ず気づけるようにする
  var isMismatch = siteResult.error || siteResult.count !== actualCount;

  if (!isMismatch) {
    Logger.log('weeklyIntegrityCheck: 一致しているため通知なし');
    return; // 一致：正常なので何もしない
  }

  var siteCountText = siteResult.error
    ? '取得エラー（' + siteResult.error + '）'
    : String(siteResult.count);

  var subject = '【🚨要確認🚨】エントリー数にズレがあります';
  var body =
    'スプレッドシートとサイト表示のエントリー数にズレを検出しました。\n\n' +
    '・対象大会：' + CURRENT_EVENT + '\n' +
    '・スプレッドシート上の実際の数：' + actualCount + '\n' +
    '・サイトに反映されている数：' + siteCountText + '\n\n' +
    'ご確認をお願いします。';

  GmailApp.sendEmail(NOTIFY_EMAIL, subject, body, { name: 'Fantasista Cup 整合性チェック' });
}

/**
 * スプレッドシートを直接数え直す（doGetの集計ロジックと同じ「完全一致」ルールを使用）
 */
function countActualEntries_(eventName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var count = 0;

  if (eventName && lastRow > 1) {
    var values = sheet.getRange(2, 5, lastRow - 1, 1).getValues(); // E列：問い合わせ内容／エントリー希望大会
    for (var i = 0; i < values.length; i++) {
      if (values[i][0] === eventName) count++;
    }
  }

  return count;
}

/**
 * 本番公開中のウェブアプリURL（doGet）を外部から実際に叩いて、現在の表示値を取得する
 */
function fetchSiteCount_(eventName) {
  try {
    var url = GAS_WEB_APP_URL + '?event=' + encodeURIComponent(eventName);
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) {
      return { error: 'HTTP ' + response.getResponseCode() };
    }

    var data = JSON.parse(response.getContentText());
    if (typeof data.count !== 'number') {
      return { error: 'countフィールドが取得できませんでした' };
    }

    return { count: data.count };
  } catch (err) {
    return { error: String(err) };
  }
}
