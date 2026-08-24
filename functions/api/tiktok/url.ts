import { Env, PagesFunction } from '../../types';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const telegramId = url.searchParams.get('telegram_id') || 'dev_user';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-telegram-user-id',
    'Content-Type': 'application/json',
  };

  const clientKey = context.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) {
    return new Response(
      JSON.stringify({
        error: 'TIKTOK_CLIENT_KEY is not configured in Cloudflare Pages environment variables',
      }),
      {
        status: 400,
        headers: corsHeaders,
      }
    );
  }
  const redirectUri = `https://shortsmaster.pages.dev/api/tiktok/callback`;
  // Standard TikTok Login Kit + Video Post v2 scopes (comma-separated, without deprecated profile scope)
  const requestedScope = url.searchParams.get('scope');
  const scopes = requestedScope || 'user.info.basic,video.upload';

  const authParams = new URLSearchParams({
    client_key: clientKey,
    scope: scopes,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: telegramId,
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${authParams.toString()}`;

  return new Response(JSON.stringify({ url: authUrl }), {
    status: 200,
    headers: corsHeaders,
  });
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
