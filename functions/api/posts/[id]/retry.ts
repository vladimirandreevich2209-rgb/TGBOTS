import { PagesFunction, Env } from '../../../types';

export const onRequestPost: PagesFunction<Env, 'id'> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';
  const postId = context.params.id as string;

  try {
    if (context.env.DB) {
      await context.env.DB.prepare(
        "UPDATE posts SET status = 'published', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR user_id = ?)"
      )
        .bind(postId, userId, 'dev_user')
        .run();

      const post = await context.env.DB.prepare('SELECT * FROM posts WHERE id = ?')
        .bind(postId)
        .first<any>();

      if (post) {
        return new Response(
          JSON.stringify({
            ...post,
            platforms: post.platforms ? JSON.parse(post.platforms) : ['youtube', 'tiktok'],
            published_ids: post.published_ids ? JSON.parse(post.published_ids) : {},
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          }
        );
      }
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
