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

  const clientId = context.env.GOOGLE_CLIENT_ID;
  const clientSecret = context.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response(
      `<html><body><h3>Ошибка сервера: GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET не настроены в Cloudflare.</h3></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    // Exchange authorization code for tokens
    const redirectUri = `${url.origin}/api/youtube/callback`;
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
      // Ensure table exists
      await context.env.DB.exec(`
        CREATE TABLE IF NOT EXISTS users (
          telegram_id TEXT PRIMARY KEY,
          youtube_refresh_token TEXT,
          tiktok_access_token TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await context.env.DB.prepare(`
        INSERT INTO users (telegram_id, youtube_refresh_token) 
        VALUES (?, ?) 
        ON CONFLICT(telegram_id) 
        DO UPDATE SET youtube_refresh_token = excluded.youtube_refresh_token, updated_at = CURRENT_TIMESTAMP
      `)
        .bind(telegramId, refreshToken)
        .run();
    }

    // HTML response that handles popup close or immediate redirect
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>YouTube подключен!</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #17212B; color: #fff; text-align: center; padding: 40px 20px; }
    .card { max-width: 400px; margin: 0 auto; background: #242F3D; padding: 24px; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    h2 { color: #4ade80; margin-top: 0; }
    p { color: #708499; font-size: 14px; }
    a { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #3390EC; color: #fff; text-decoration: none; border-radius: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <h2>✓ YouTube Shorts подключен!</h2>
    <p>Авторизация прошла успешно. Вы можете вернуться в Telegram Mini App.</p>
    <a href="${appOrigin}">Перейти в ShortsMaster</a>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', platform: 'youtube' }, '*');
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
    console.error('Error in YouTube callback:', err);
    return new Response(
      `<html><body><h3>Внутренняя ошибка сервера: ${err.message}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
};
