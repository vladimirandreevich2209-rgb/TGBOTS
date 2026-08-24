import { Env, PagesFunction } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const telegramId = url.searchParams.get('telegram_id');

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-telegram-user-id',
    'Content-Type': 'application/json',
  };

  if (!telegramId) {
    return new Response(
      JSON.stringify({ error: 'Missing telegram_id parameter', hasYouTube: false, hasTikTok: false }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // If D1 is configured
    if (context.env.DB) {
      let user = await context.env.DB.prepare(
        'SELECT youtube_refresh_token, tiktok_access_token FROM users WHERE telegram_id = ?'
      )
        .bind(telegramId)
        .first<{ youtube_refresh_token: string | null; tiktok_access_token: string | null }>();

      // If this is a real Telegram user (not dev_user) and hasn't connected yet,
      // check if tokens exist in 'dev_user' (from PC browser) and auto-sync them!
      if (telegramId !== 'dev_user' && (!user || (!user.youtube_refresh_token && !user.tiktok_access_token))) {
        const devUser = await context.env.DB.prepare(
          'SELECT youtube_refresh_token, tiktok_access_token FROM users WHERE telegram_id = ?'
        )
          .bind('dev_user')
          .first<{ youtube_refresh_token: string | null; tiktok_access_token: string | null }>();

        if (devUser && (devUser.youtube_refresh_token || devUser.tiktok_access_token)) {
          // Sync tokens to the real telegramId
          await context.env.DB.prepare(
            `INSERT INTO users (telegram_id, youtube_refresh_token, tiktok_access_token)
             VALUES (?, ?, ?)
             ON CONFLICT(telegram_id) DO UPDATE SET
               youtube_refresh_token = COALESCE(excluded.youtube_refresh_token, users.youtube_refresh_token),
               tiktok_access_token = COALESCE(excluded.tiktok_access_token, users.tiktok_access_token),
               updated_at = CURRENT_TIMESTAMP`
          )
            .bind(telegramId, devUser.youtube_refresh_token, devUser.tiktok_access_token)
            .run();

          user = devUser;
        }
      }

      const hasYouTube = Boolean(user && user.youtube_refresh_token);
      const hasTikTok = Boolean(user && user.tiktok_access_token);

      return new Response(
        JSON.stringify({
          hasYouTube,
          hasTikTok,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Fallback if DB binding is not yet attached
    return new Response(
      JSON.stringify({
        hasYouTube: false,
        hasTikTok: false,
        warning: 'D1 DB binding not detected',
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Error fetching user status from D1:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal Server Error',
        hasYouTube: false,
        hasTikTok: false,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-telegram-user-id',
    },
  });
};
