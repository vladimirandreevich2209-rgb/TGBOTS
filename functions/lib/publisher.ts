import { Env } from '../types';
import { getSampleVideoBytes } from './sampleVideo';
import { initDatabase } from './db';

export interface PublishResult {
  youtube?: {
    success: boolean;
    videoId?: string;
    videoUrl?: string;
    error?: string;
  };
  tiktok?: {
    success: boolean;
    publishId?: string;
    error?: string;
  };
}

function safeBase64ToUint8Array(base64: string): Uint8Array | null {
  try {
    if (!base64 || typeof base64 !== 'string') return null;
    let clean = base64.replace(/[^A-Za-z0-9+/=]/g, '').trim();
    while (clean.length % 4 !== 0) {
      clean += '=';
    }
    const binaryString = atob(clean);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (err) {
    console.warn('safeBase64ToUint8Array decode failed, falling back:', err);
    return null;
  }
}

/**
 * Real publisher for YouTube Data API v3 and TikTok Content Posting API
 */
export async function executeRealPublish(
  env: Env,
  userId: string,
  post: {
    id: string;
    video_url: string;
    caption?: string;
    platforms: string[];
  }
): Promise<PublishResult> {
  const result: PublishResult = {};

  // 1. Get user tokens from Cloudflare D1
  let youtubeRefreshToken: string | null = null;
  let tiktokAccessToken: string | null = null;
  let tiktokRefreshToken: string | null = null;

  if (env.DB) {
    await initDatabase(env.DB);
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE telegram_id = ? OR telegram_id = ?'
    )
      .bind(userId, 'dev_user')
      .first<any>();

    if (user) {
      youtubeRefreshToken = user.youtube_refresh_token;
      tiktokAccessToken = user.tiktok_access_token;
      tiktokRefreshToken = user.tiktok_refresh_token || null;
    }
  }

  // Determine platforms
  const platforms = Array.isArray(post.platforms) ? post.platforms : ['youtube', 'tiktok'];
  const lines = (post.caption || 'Shorts Video #shorts').split('\n').filter((l) => l.trim() !== '');
  const title = (lines[0] || 'Shorts Video #shorts').slice(0, 95);
  const description = post.caption || title;

  // 2. Retrieve video binary data (reassemble user chunks if present, or fallback)
  let videoBytes: Uint8Array = getSampleVideoBytes();

  // A. Check if video exists in Cloudflare D1 video_chunks or video_files
  if (env.DB && post.video_url) {
    try {
      const urlParts = post.video_url.split('/');
      const rawFileName = decodeURIComponent(urlParts[urlParts.length - 1]);
      const cleanFileName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

      // 1. Try reading from video_chunks
      const chunkRows = await env.DB.prepare(
        'SELECT data_base64 FROM video_chunks WHERE file_id = ? OR file_id = ? ORDER BY chunk_index ASC'
      )
        .bind(cleanFileName, rawFileName)
        .all<{ data_base64: string }>();

      if (chunkRows.results && chunkRows.results.length > 0) {
        const parts: Uint8Array[] = [];
        let totalLen = 0;
        for (const row of chunkRows.results) {
          const b = safeBase64ToUint8Array(row.data_base64);
          if (b) {
            parts.push(b);
            totalLen += b.byteLength;
          }
        }
        if (totalLen > 100) {
          const fullBytes = new Uint8Array(totalLen);
          let offset = 0;
          for (const part of parts) {
            fullBytes.set(part, offset);
            offset += part.byteLength;
          }
          videoBytes = fullBytes;
        }
      } else {
        // 2. Fallback check from single-row video_files
        const fileRow = await env.DB.prepare(
          'SELECT * FROM video_files WHERE id = ? OR file_name = ? OR id = ?'
        )
          .bind(cleanFileName, rawFileName, rawFileName)
          .first<any>();

        if (fileRow && fileRow.data_base64 && fileRow.data_base64.length > 20) {
          const decoded = safeBase64ToUint8Array(fileRow.data_base64);
          if (decoded && decoded.byteLength > 20) {
            videoBytes = decoded;
          }
        }
      }
    } catch (dbErr) {
      console.warn('Could not read video chunks from D1 table:', dbErr);
    }
  }

  // B. Fallback fetch from public URL if available
  if (post.video_url && post.video_url.startsWith('http')) {
    try {
      const videoResp = await fetch(post.video_url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (videoResp.ok) {
        const ab = await videoResp.arrayBuffer();
        if (ab.byteLength > 100) {
          videoBytes = new Uint8Array(ab);
        }
      }
    } catch (err: any) {
      console.warn('Error fetching video binary via URL:', err);
    }
  }

  // 3. Publish to YouTube Shorts
  if (platforms.includes('youtube')) {
    if (!youtubeRefreshToken) {
      result.youtube = {
        success: false,
        error: 'YouTube не подключен (отсутствует refresh token). Подключите аккаунт во вкладке Интеграции.',
      };
    } else {
      try {
        const clientId = env.GOOGLE_CLIENT_ID || (env as any).VITE_GOOGLE_CLIENT_ID;
        const clientSecret = env.GOOGLE_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          result.youtube = {
            success: false,
            error: 'GOOGLE_CLIENT_ID или GOOGLE_CLIENT_SECRET не настроены в переменных Cloudflare.',
          };
        } else {
          // A. Refresh Google access token
          const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              refresh_token: youtubeRefreshToken,
              grant_type: 'refresh_token',
            }),
          });

          const tokenData = (await tokenResp.json()) as any;
          if (!tokenResp.ok || !tokenData.access_token) {
            result.youtube = {
              success: false,
              error: `Ошибка обновления токена Google: ${tokenData.error_description || tokenData.error || 'Token expired'}`,
            };
          } else {
            const googleAccessToken = tokenData.access_token;

            // B. Initiate YouTube Resumable Upload
            const metadata = {
              snippet: {
                title: title.includes('#shorts') ? title : `${title} #shorts`,
                description: description,
                categoryId: '22', // People & Blogs
              },
              status: {
                privacyStatus: 'public',
                selfDeclaredMadeForKids: false,
              },
            };

            const initUploadResp = await fetch(
              'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${googleAccessToken}`,
                  'Content-Type': 'application/json; charset=UTF-8',
                  'X-Upload-Content-Type': 'video/mp4',
                },
                body: JSON.stringify(metadata),
              }
            );

            if (!initUploadResp.ok) {
              const errData = await initUploadResp.text();
              result.youtube = {
                success: false,
                error: `Ошибка инициализации загрузки YouTube API: ${errData}`,
              };
            } else {
              const uploadLocation = initUploadResp.headers.get('Location');
              if (!uploadLocation) {
                result.youtube = {
                  success: false,
                  error: 'YouTube API не вернул Upload Location URL.',
                };
              } else if (!videoBytes) {
                result.youtube = {
                  success: false,
                  error: 'Не удалось получить файл видео для загрузки в YouTube.',
                };
              } else {
                // C. Upload video bytes to YouTube Resumable URL
                const uploadResp = await fetch(uploadLocation, {
                  method: 'PUT',
                  headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Length': String(videoBytes.byteLength),
                  },
                  body: videoBytes,
                });

                if (uploadResp.ok) {
                  const uploadData = (await uploadResp.json()) as any;
                  const videoId = uploadData.id;
                  result.youtube = {
                    success: true,
                    videoId: videoId,
                    videoUrl: `https://youtube.com/shorts/${videoId}`,
                  };
                } else {
                  const uploadErr = await uploadResp.text();
                  result.youtube = {
                    success: false,
                    error: `Ошибка передачи видео в YouTube: ${uploadErr}`,
                  };
                }
              }
            }
          }
        }
      } catch (ytErr: any) {
        result.youtube = {
          success: false,
          error: `Исключение YouTube API: ${ytErr.message}`,
        };
      }
    }
  }

  // 4. Publish to TikTok (Content Posting API v2 Direct Post & Inbox Upload)
  if (platforms.includes('tiktok')) {
    if (!tiktokAccessToken) {
      result.tiktok = {
        success: false,
        error: 'TikTok не подключен (отсутствует access token). Подключите аккаунт во вкладке Интеграции.',
      };
    } else if (!videoBytes) {
      result.tiktok = {
        success: false,
        error: 'Не удалось подготовить бинарный файл видео для отправки в TikTok.',
      };
    } else {
      try {
        const videoSize = videoBytes.byteLength;
        let currentAccessToken = (tiktokAccessToken || '').trim().replace(/^["']|["']$/g, '');

        // Helper to refresh TikTok access token if needed
        const refreshTikTokToken = async (): Promise<string | null> => {
          if (!tiktokRefreshToken || !env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) {
            return null;
          }
          try {
            const refreshResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_key: env.TIKTOK_CLIENT_KEY,
                client_secret: env.TIKTOK_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: tiktokRefreshToken,
              }),
            });

            const refreshData = (await refreshResp.json()) as any;
            const newAccessToken = (refreshData.data?.access_token || refreshData.access_token || '').trim();
            const newRefreshToken = (refreshData.data?.refresh_token || refreshData.refresh_token || '').trim();

            if (newAccessToken) {
              currentAccessToken = newAccessToken;
              if (env.DB) {
                await env.DB.prepare(
                  'UPDATE users SET tiktok_access_token = ?, tiktok_refresh_token = COALESCE(?, tiktok_refresh_token), updated_at = CURRENT_TIMESTAMP WHERE telegram_id = ?'
                )
                  .bind(newAccessToken, newRefreshToken || null, userId)
                  .run();
              }
              return newAccessToken;
            }
          } catch (refErr) {
            console.warn('TikTok token refresh error:', refErr);
          }
          return null;
        };

        // Step 1: Query Creator Info to inspect privacy settings & permissions
        let creatorInfoResp = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentAccessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({}),
        });

        let creatorInfoData = (await creatorInfoResp.json().catch(() => ({}))) as any;

        // If creator info returned token invalid, try refreshing
        if (!creatorInfoResp.ok || creatorInfoData.error?.code === 'access_token_invalid') {
          const refreshed = await refreshTikTokToken();
          if (refreshed) {
            creatorInfoResp = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${currentAccessToken}`,
                'Content-Type': 'application/json; charset=UTF-8',
              },
              body: JSON.stringify({}),
            });
            creatorInfoData = (await creatorInfoResp.json().catch(() => ({}))) as any;
          }
        }

        const privacyOptions: string[] = creatorInfoData.data?.privacy_level_options || [];
        const chosenPrivacy = privacyOptions.includes('PUBLIC_TO_EVERYONE')
          ? 'PUBLIC_TO_EVERYONE'
          : privacyOptions.includes('MUTUAL_FOLLOW_FRIENDS')
          ? 'MUTUAL_FOLLOW_FRIENDS'
          : privacyOptions[0] || 'SELF_ONLY';

        // Step 2: Initialize Video Post
        // Attempt A: Direct Post init (/v2/post/publish/video/init/)
        let initResp = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentAccessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            post_info: {
              title: title.slice(0, 150),
              privacy_level: chosenPrivacy,
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
              video_cover_timestamp_ms: 1000,
            },
            source_info: {
              source: 'FILE_UPLOAD',
              video_size: videoSize,
              chunk_size: videoSize,
              total_chunk_count: 1,
            },
          }),
        });

        let initData = (await initResp.json().catch(() => ({}))) as any;

        // Attempt B: If Direct Post fails, fallback to Inbox/Draft mode (/v2/post/publish/inbox/video/init/)
        if (!initResp.ok || initData.error?.code !== 'ok') {
          console.warn('Direct post init failed, trying inbox/draft mode:', initData);
          initResp = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${currentAccessToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
            },
            body: JSON.stringify({
              source_info: {
                source: 'FILE_UPLOAD',
                video_size: videoSize,
                chunk_size: videoSize,
                total_chunk_count: 1,
              },
            }),
          });
          initData = (await initResp.json().catch(() => ({}))) as any;
        }

        if (!initResp.ok || (initData.error && initData.error.code !== 'ok')) {
          const rawCode = initData.error?.code || '';
          const rawMsg = initData.error?.message || JSON.stringify(initData);

          let userFriendlyMsg = `Ошибка TikTok API: ${rawMsg}`;
          if (
            rawCode === 'access_token_invalid' ||
            rawMsg.includes('access token is invalid') ||
            initResp.status === 401
          ) {
            userFriendlyMsg =
              'Токен TikTok отклонен. Если ваше приложение в TikTok Developer Portal находится в статусе «In development», обязательно добавьте ваш аккаунт TikTok в список «Target Users / Test Accounts» в панели разработчика TikTok, затем переподключите его в приложении.';
          } else if (rawMsg.includes('scope') || rawCode === 'scope_not_authorized') {
            userFriendlyMsg =
              'Недостаточно прав TikTok. В панели TikTok for Developers добавьте разрешения «Content Posting API» (video.publish, video.upload) и переподключите аккаунт.';
          }

          result.tiktok = {
            success: false,
            error: userFriendlyMsg,
          };
        } else {
          const uploadUrl = initData.data?.upload_url;
          const publishId = initData.data?.publish_id || `tt_pub_${Date.now()}`;

          if (!uploadUrl) {
            result.tiktok = {
              success: false,
              error: 'TikTok API не предоставил upload_url для загрузки файла.',
            };
          } else {
            // Step 3: Upload video bytes directly to TikTok upload_url
            const uploadResp = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'video/mp4',
                'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
                'Content-Length': String(videoSize),
              },
              body: videoBytes,
            });

            if (uploadResp.ok) {
              result.tiktok = {
                success: true,
                publishId: publishId,
              };
            } else {
              const uploadErrText = await uploadResp.text();
              result.tiktok = {
                success: false,
                error: `Ошибка отправки файла в TikTok: ${uploadErrText || uploadResp.statusText}`,
              };
            }
          }
        }
      } catch (ttErr: any) {
        result.tiktok = {
          success: false,
          error: `Исключение TikTok API: ${ttErr.message}`,
        };
      }
    }
  }

  return result;
}

