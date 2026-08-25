import { Env, PagesFunction } from '../../types';
import { initDatabase } from '../../lib/db';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const headerId = context.request.headers.get('x-telegram-user-id');
  const telegramId = url.searchParams.get('telegram_id') || headerId || 'dev_user';

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-telegram-user-id',
    'Content-Type': 'application/json',
  };

  const results: any = {
    telegramId,
    timestamp: new Date().toISOString(),
    d1_database_connected: Boolean(context.env.DB),
    tiktok_credentials_configured: {
      hasClientKey: Boolean(context.env.TIKTOK_CLIENT_KEY),
      clientKeyLength: (context.env.TIKTOK_CLIENT_KEY || '').trim().length,
      hasClientSecret: Boolean(context.env.TIKTOK_CLIENT_SECRET),
      clientSecretLength: (context.env.TIKTOK_CLIENT_SECRET || '').trim().length,
    },
    user_in_db: null,
    creator_info_test: null,
    user_info_test: null,
  };

  if (!context.env.DB) {
    return new Response(JSON.stringify(results, null, 2), { status: 200, headers: corsHeaders });
  }

  await initDatabase(context.env.DB);

  let user = await context.env.DB.prepare(
    'SELECT * FROM users WHERE telegram_id = ?'
  )
    .bind(telegramId)
    .first<any>();

  // If not found for numeric ID, check dev_user
  if (!user && telegramId !== 'dev_user') {
    user = await context.env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ?'
    )
      .bind('dev_user')
      .first<any>();
  }

  if (!user) {
    results.user_in_db = { found: false, note: 'No user record found in D1' };
    return new Response(JSON.stringify(results, null, 2), { status: 200, headers: corsHeaders });
  }

  const token = (user.tiktok_access_token || '').trim();
  const refreshToken = (user.tiktok_refresh_token || '').trim();

  results.user_in_db = {
    found: true,
    has_tiktok_token: Boolean(token),
    token_length: token.length,
    token_preview: token ? `${token.substring(0, 10)}...${token.substring(token.length - 6)}` : null,
    has_refresh_token: Boolean(refreshToken),
    open_id: user.tiktok_open_id || null,
    scope: user.tiktok_scope || null,
    updated_at: user.updated_at,
  };

  if (token) {
    try {
      // Test 1: Creator Info (Content Posting API)
      const creatorResp = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({}),
      });

      const creatorData = await creatorResp.json().catch(() => ({}));
      results.creator_info_test = {
        http_status: creatorResp.status,
        response: creatorData,
      };

      // Test 2: User info (Login Kit)
      const userResp = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const userData = await userResp.json().catch(() => ({}));
      results.user_info_test = {
        http_status: userResp.status,
        response: userData,
      };
    } catch (err: any) {
      results.api_fetch_error = err.message;
    }
  }

  return new Response(JSON.stringify(results, null, 2), { status: 200, headers: corsHeaders });
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
