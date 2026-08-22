import { Env, PagesFunction } from '../../types';

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

  const clientKey = context.env.TIKTOK_CLIENT_KEY;
  const clientSecret = context.env.TIKTOK_CLIENT_SECRET;

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

    if (!tokenResponse.ok || tokenData.error || !tokenData.data?.access_token && !tokenData.access_token) {
      console.error('TikTok token exchange error:', tokenData);
      const errMsg = tokenData.error_description || tokenData.message || tokenData.error || 'Token error';
      return new Response(
        `<html><body><h3>Ошибка обмена токена TikTok: ${errMsg}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const accessToken = tokenData.data?.access_token || tokenData.access_token;

    // Save to Cloudflare D1
    if (context.env.DB) {
      await context.env.DB.exec(`
        CREATE TABLE IF NOT EXISTS users (
          telegram_id TEXT PRIMARY KEY,
          youtube_refresh_token TEXT,
          tiktok_access_token TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await context.env.DB.prepare(`
        INSERT INTO users (telegram_id, tiktok_access_token) 
        VALUES (?, ?) 
        ON CONFLICT(telegram_id) 
        DO UPDATE SET tiktok_access_token = excluded.tiktok_access_token, updated_at = CURRENT_TIMESTAMP
      `)
        .bind(telegramId, accessToken)
        .run();
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>TikTok подключен!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #17212B; color: #fff; text-align: center; padding: 40px 20px; }
    .card { max-width: 400px; margin: 0 auto; background: #242F3D; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    h2 { color: #22d3ee; margin-top: 0; }
    p { color: #708499; font-size: 14px; }
    a { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #3390EC; color: #fff; text-decoration: none; border-radius: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2>✓ TikTok подключен!</h2>
    <p>Авторизация прошла успешно. Токен сохранен в Cloudflare D1.</p>
    <a href="${appOrigin}">Перейти в ShortsMaster</a>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', platform: 'tiktok' }, '*');
        setTimeout(() => window.close(), 1200);
      } else {
        setTimeout(() => { window.location.href = '${appOrigin}'; }, 1500);
      }
    } catch (e) {
      window.location.href = '${appOrigin}';
    }
  </script>
</body>
</html>`;

    return new Response(html, {
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
