import { PagesFunction, Env } from '../../../types';
import { executeRealPublish } from '../../../lib/publisher';

export const onRequestPost: PagesFunction<Env, 'id'> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';
  const postId = context.params.id as string;

  try {
    if (context.env.DB) {
      const post = await context.env.DB.prepare('SELECT * FROM posts WHERE id = ? AND (user_id = ? OR user_id = ?)')
        .bind(postId, userId, 'dev_user')
        .first<any>();

      if (!post) {
        return new Response(JSON.stringify({ error: 'Пост не найден' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }

      const platforms = post.platforms ? JSON.parse(post.platforms) : ['youtube', 'tiktok'];
      const pubResult = await executeRealPublish(context.env, post.user_id || userId, {
        id: post.id,
        video_url: post.video_url,
        caption: post.caption || '',
        platforms,
      });

      let hasSuccess = false;
      const errors: string[] = [];
      const publishedIdsObj: Record<string, any> = {};

      if (pubResult.youtube) {
        if (pubResult.youtube.success && pubResult.youtube.videoId) {
          publishedIdsObj.youtube_video_id = pubResult.youtube.videoId;
          hasSuccess = true;
        } else if (pubResult.youtube.error) {
          errors.push(`YouTube: ${pubResult.youtube.error}`);
        }
      }

      if (pubResult.tiktok) {
        if (pubResult.tiktok.success && pubResult.tiktok.publishId) {
          publishedIdsObj.tiktok_publish_id = pubResult.tiktok.publishId;
          hasSuccess = true;
        } else if (pubResult.tiktok.error) {
          errors.push(`TikTok: ${pubResult.tiktok.error}`);
        }
      }

      const newStatus = hasSuccess ? 'published' : errors.length > 0 ? 'failed' : 'published';
      const errMsg = errors.length > 0 ? errors.join('; ') : null;
      const pubIdsStr = JSON.stringify(publishedIdsObj);

      await context.env.DB.prepare(
        'UPDATE posts SET status = ?, error_message = ?, published_ids = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      )
        .bind(newStatus, errMsg, pubIdsStr, postId)
        .run();

      const updated = await context.env.DB.prepare('SELECT * FROM posts WHERE id = ?')
        .bind(postId)
        .first<any>();

      if (updated) {
        return new Response(
          JSON.stringify({
            ...updated,
            platforms: updated.platforms ? JSON.parse(updated.platforms) : ['youtube', 'tiktok'],
            published_ids: updated.published_ids ? JSON.parse(updated.published_ids) : {},
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
