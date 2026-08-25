import { Env, PagesFunction } from '../../types';
import { initDatabase } from '../../lib/db';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const telegramId = url.searchParams.get('state');
  const error = url.searchParams.get('error') || url.searchParams.get('error_description');

  const appOrigin = 'https://shortsmaster.pages.dev';

  if (error) {
    return new Response(
      `<html><body><h3>TikTok OAuth Error: ${error}</h3><p><a href="${appOrigin}">Вернуться в приложение</a></p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!code || !telegramId) {
    return new Response(
      `<html><body><h3>Ошибка: Отсутствует код подтверждения или Telegram ID.</h3><p><a href="${appOrigin}">Вернуться в приложение</a></p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const clientKey = (context.env.TIKTOK_CLIENT_KEY || '').trim();
  const clientSecret = (context.env.TIKTOK_CLIENT_SECRET || '').trim();

  if (!clientKey || !clientSecret) {
    return new Response(
      `<html><body><h3>Ошибка: TIKTOK_CLIENT_KEY или TIKTOK_CLIENT_SECRET не настроены в Cloudflare.</h3></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    const redirectUri = `https://shortsmaster.pages.dev/api/tiktok/callback`;
    const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;

    if (!tokenResponse.ok || tokenData.error || (!tokenData.data?.access_token && !tokenData.access_token)) {
      console.error('TikTok token exchange error:', tokenData);
      const errMsg = tokenData.error_description || tokenData.message || tokenData.error?.message || tokenData.error || 'Token error';
      return new Response(
        `<html><body><h3>Ошибка обмена токена TikTok: ${errMsg}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const accessToken = (tokenData.data?.access_token || tokenData.access_token || '').trim();
    const refreshToken = (tokenData.data?.refresh_token || tokenData.refresh_token || '').trim() || null;
    const openId = (tokenData.data?.open_id || tokenData.open_id || '').trim() || null;
    const scope = (tokenData.data?.scope || tokenData.scope || '').trim() || null;

    // Save to Cloudflare D1
    if (context.env.DB) {
      await initDatabase(context.env.DB);

      await context.env.DB.prepare(
        `INSERT INTO users (telegram_id, tiktok_access_token, tiktok_refresh_token, tiktok_open_id, tiktok_scope)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(telegram_id) DO UPDATE SET
           tiktok_access_token = excluded.tiktok_access_token,
           tiktok_refresh_token = COALESCE(excluded.tiktok_refresh_token, users.tiktok_refresh_token),
           tiktok_open_id = COALESCE(excluded.tiktok_open_id, users.tiktok_open_id),
           tiktok_scope = COALESCE(excluded.tiktok_scope, users.tiktok_scope),
           updated_at = CURRENT_TIMESTAMP`
      )
        .bind(telegramId, accessToken, refreshToken, openId, scope)
        .run();
    }

    // Success response with auto-redirect and popup handler
    const successHtml = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TikTok подключен!</title>
  <style>
    body {
      background: #0f172a;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .icon {
      width: 64px;
      height: 64px;
      background: #000;
      border: 2px solid #00f2fe;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      fill: #00f2fe;
    }
    h2 {
      margin: 0 0 8px 0;
      font-size: 22px;
      font-weight: 700;
    }
    p {
      color: #94a3b8;
      font-size: 14px;
      margin: 0 0 24px 0;
      line-height: 1.5;
    }
    .btn {
      display: inline-block;
      width: 100%;
      background: #3b82f6;
      color: white;
      text-decoration: none;
      padding: 14px 20px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      box-sizing: border-box;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
    </div>
    <h2>TikTok успешно подключен!</h2>
    <p>Аккаунт привязан к боту. Возвращаемся в приложение...</p>
    <a id="return-link" class="btn" href="${appOrigin}">Вернуться в приложение</a>
  </div>
  <script>
    if (window.opener) {
      try {
        window.opener.postMessage({ type: 'oauth_success', platform: 'tiktok' }, '*');
        setTimeout(() => window.close(), 1500);
      } catch (e) {}
    }
    setTimeout(() => {
      window.location.href = '${appOrigin}';
    }, 1500);
  </script>
</body>
</html>
    `;

    return new Response(successHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: any) {
    console.error('Error in TikTok callback:', err);
    return new Response(
      `<html><body><h3>Внутренняя ошибка сервера: ${err.message}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
};
