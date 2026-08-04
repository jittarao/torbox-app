import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { publicApiErrorResponse } from '@/utils/sanitizeError';

export async function GET(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const fileId = searchParams.get('file_id');
  const type = searchParams.get('type') || 'torrent';
  const chosenSubtitleIndex = searchParams.get('chosen_subtitle_index');
  const chosenAudioIndex = searchParams.get('chosen_audio_index') || '0';

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ success: false, error: 'Download ID is required' }, { status: 400 });
  }

  if (!fileId) {
    return NextResponse.json({ success: false, error: 'File ID is required' }, { status: 400 });
  }

  try {
    const queryParams = new URLSearchParams({
      id: id,
      file_id: fileId,
      type: type,
      ...(chosenSubtitleIndex !== null &&
        chosenSubtitleIndex !== undefined && { chosen_subtitle_index: chosenSubtitleIndex }),
      chosen_audio_index: chosenAudioIndex,
    });

    const apiUrl = `${API_BASE}/${API_VERSION}/api/stream/createstream?${queryParams}`;
    const response = await torboxFetch(apiUrl, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    // TorBox contract: trust `success`, not only HTTP status.
    if (response.ok && data.success !== false) {
      return NextResponse.json(data);
    }

    const errorCode = data.error || `API responded with status: ${response.status}`;
    console.error('Error creating stream:', errorCode, data.detail || '');
    const { body, status } = publicApiErrorResponse(
      { error: errorCode, detail: data.detail },
      { fallbackStatus: response.ok ? 502 : response.status || 500 }
    );
    return NextResponse.json(body, { status });
  } catch (error) {
    console.error('Error creating stream:', error);
    const { body, status } = publicApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
