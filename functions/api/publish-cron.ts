import { PagesFunction, Env } from '../types';
import { executeRealPublish } from '../lib/publisher';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const headerId = context.request.headers.get('x-telegram-user-id');
  const userId = headerId && headerId.trim() !== '' ? headerId.trim() : 'dev_user';

  try {
    let processed = 0;
    const results: any[] = [];

    if (context.env.DB) {
      // Find scheduled posts that are due
      const now = new Date().toISOString();
      const { results: duePosts } = await context.env.DB.prepare(
        "SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_at <= ? AND (user_id = ? OR user_id = ?)"
      )
        .bind(now, userId, 'dev_user')
        .all<any>();

      if (duePosts && duePosts.length > 0) {
        for (const post of duePosts) {
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
            .bind(newStatus, errMsg, pubIdsStr, post.id)
            .run();

          processed++;
          results.push({ id: post.id, status: newStatus, error: errMsg, published_ids: publishedIdsObj });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: err.message || 'Ошибка выполнения cron',
        processed: 0,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
};

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
};
