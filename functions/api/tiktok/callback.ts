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

    // 302 redirect back to the application
    return Response.redirect('https://shortsmaster.pages.dev', 302);
  } catch (err: any) {
    console.error('Error in TikTok callback:', err);
    return new Response(
      `<html><body><h3>Внутренняя ошибка сервера: ${err.message}</h3><p><a href="${appOrigin}">Назад</a></p></body></html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
};
