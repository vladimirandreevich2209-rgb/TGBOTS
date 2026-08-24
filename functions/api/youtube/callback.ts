import { Env, PagesFunction } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  const telegramId = url.searchParams.get('state'); // state holds telegram_id
  const error = url.searchParams.get('error');

  const appOrigin = 'https://shortsmaster.pages.dev';

  if (error) {
    return new Response(
      `<html><body><h3>Google OAuth Error: ${error}</h3><p><a href="${appOrigin}">Вернуться в приложение</a></p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  if (!code || !telegramId) {
    return new Response(
      `<html><body><h3>Ошибка: Отсутствует код подтверждения или Telegram ID.</h3><p><a href="${appOrigin}">Вернуться в приложение</a></p></body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  const clientId = context.env.GOOGLE_CLIENT_ID || (context.env as any).VITE_GOOGLE_CLIENT_ID;
  const clientSecret = context.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const missing = [];
    if (!clientId) missing.push('GOOGLE_CLIENT_ID');
    if (!clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
    return new Response(
      `<html><body><h3>Ошибка сервера: ${missing.join(', ')} не настроены в переменных Cloudflare Pages (или требуется перезапустить деплой после их добавления).</h3></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    // Exchange authorization code for tokens
    const redirectUri = 'https://shortsmaster.pages.dev/api/youtube/callback';
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = (await tokenResponse.json()) as any;

    if (!tokenResponse.ok || !tokenData.refresh_token && !tokenData.access_token) {
      console.error('Google token exchange error:', tokenData);
      return new Response(
        `<html><body><h3>Ошибка обмена токена Google: ${tokenData.error_description || tokenData.error || 'Unknown error'}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const refreshToken = tokenData.refresh_token || tokenData.access_token;

    // Save to Cloudflare D1
    if (context.env.DB) {
      // Ensure table exists with single-line prepared statement
      await context.env.DB.prepare(
        'CREATE TABLE IF NOT EXISTS users (telegram_id TEXT PRIMARY KEY, youtube_refresh_token TEXT, tiktok_access_token TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)'
      ).run();

      await context.env.DB.prepare(
        'INSERT INTO users (telegram_id, youtube_refresh_token) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET youtube_refresh_token = excluded.youtube_refresh_token, updated_at = CURRENT_TIMESTAMP'
      )
        .bind(telegramId, refreshToken)
        .run();
    }

    // Success response with auto-redirect and popup handler
    const successHtml = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouTube подключен!</title>
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
      background: #ef4444;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .icon svg {
      width: 32px;
      height: 32px;
      fill: #fff;
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
    <h2>YouTube успешно подключен!</h2>
    <p>Канал привязан к боту. Возвращаемся в приложение...</p>
    <a id="return-link" class="btn" href="${appOrigin}">Вернуться в приложение</a>
  </div>
  <script>
    if (window.opener) {
      try {
        window.opener.postMessage({ type: 'oauth_success', platform: 'youtube' }, '*');
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
    console.error('Error in YouTube callback:', err);
    return new Response(
      `<html><body><h3>Внутренняя ошибка сервера: ${err.message}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
};
