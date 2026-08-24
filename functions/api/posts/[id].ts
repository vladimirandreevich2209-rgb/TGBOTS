import { PagesFunction, Env } from '../../types';

export const onRequestDelete: PagesFunction<Env, 'id'> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';
  const postId = context.params.id as string;

  try {
    if (context.env.DB) {
      await context.env.DB.prepare('DELETE FROM posts WHERE id = ? AND (user_id = ? OR user_id = ?)')
        .bind(postId, userId, 'dev_user')
        .run();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
};
