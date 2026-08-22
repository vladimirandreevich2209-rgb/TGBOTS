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

    // 302 redirect back to the application
    return Response.redirect('https://shortsmaster.pages.dev', 302);
  } catch (err: any) {
    console.error('Error in YouTube callback:', err);
    return new Response(
      `<html><body><h3>Внутренняя ошибка сервера: ${err.message}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
};
