import { headers } from 'next/headers';

const API_BASE = "https://api.torbox.app";
const API_VERSION = "v1";

export async function GET(request) {
  const headersList = headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const torrentId = searchParams.get('torrent_id');
  const fileId = searchParams.get('file_id');
  const zipLink = searchParams.get('zip_link') === 'true';

  try {
    const queryParams = new URLSearchParams({
      token: apiKey,
      torrent_id: torrentId,
      ...(fileId && { file_id: fileId }),
      ...(zipLink && { zip_link: zipLink })
    });

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/torrents/requestdl?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
} 