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
      const user = await context.env.DB.prepare(
        'SELECT youtube_refresh_token, tiktok_access_token FROM users WHERE telegram_id = ?'
      )
        .bind(telegramId)
        .first<{ youtube_refresh_token: string | null; tiktok_access_token: string | null }>();

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
