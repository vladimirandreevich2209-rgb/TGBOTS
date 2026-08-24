import { PagesFunction, Env } from '../../types';

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export const onRequestGet: PagesFunction<Env, 'fileName'> = async (context) => {
  const fileName = decodeURIComponent(context.params.fileName as string);

  if (context.env.DB) {
    try {
      const fileRow = await context.env.DB.prepare(
        'SELECT * FROM video_files WHERE id = ? OR file_name = ?'
      )
        .bind(fileName, fileName)
        .first<any>();

      if (fileRow && fileRow.data_base64) {
        const bytes = base64ToArrayBuffer(fileRow.data_base64);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': fileRow.mime_type || 'video/mp4',
            'Content-Length': String(bytes.byteLength),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (e) {
      console.error('Error fetching video from D1:', e);
    }
  }

  // Fallback vertical sample
  return Response.redirect(
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    302
  );
};

