// Netlify Forms連携: 「contact」フォームで「取材・協賛のご相談」が送信された時だけ、
// GAS Webhook（sponsor-auto-reply.gs）を叩いて協賛提案PDFの自動返信メールを送らせる。
// 参照: Netlify Formsの「submission-created」関数の命名規則により、フォーム送信のたびに自動実行される。

exports.handler = async function (event) {
  try {
    const parsed = JSON.parse(event.body);
    const payload = parsed.payload || parsed;

    if (!payload || payload.form_name !== 'contact') {
      return { statusCode: 200, body: 'skip: not contact form' };
    }

    const data = payload.data || {};
    if (data['inquiry-type'] !== '取材・協賛のご相談') {
      return { statusCode: 200, body: 'skip: not sponsor inquiry' };
    }

    const webhookUrl = process.env.SPONSOR_GAS_WEBHOOK_URL;
    const secret = process.env.SPONSOR_WEBHOOK_SECRET;

    if (!webhookUrl || !secret) {
      console.error('SPONSOR_GAS_WEBHOOK_URL / SPONSOR_WEBHOOK_SECRET が未設定です');
      return { statusCode: 200, body: 'not configured' };
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        name: data.name,
        email: data.email,
        message: data.message,
      }),
    });

    console.log('sponsor webhook status:', res.status, await res.text());

    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    console.error('submission-created error:', err);
    return { statusCode: 200, body: 'error' };
  }
};
