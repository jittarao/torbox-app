import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

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
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 400 },
    );
  }

  if (!id) {
    return NextResponse.json(
      { success: false, error: 'Download ID is required' },
      { status: 400 },
    );
  }

  if (!fileId) {
    return NextResponse.json(
      { success: false, error: 'File ID is required' },
      { status: 400 },
    );
  }

  try {
    const queryParams = new URLSearchParams({
      id: id,
      file_id: fileId,
      type: type,
      ...(chosenSubtitleIndex !== null && chosenSubtitleIndex !== undefined && { chosen_subtitle_index: chosenSubtitleIndex }),
      chosen_audio_index: chosenAudioIndex,
    });
    
    const apiUrl = `${API_BASE}/${API_VERSION}/api/stream/createstream?${queryParams}`;
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating stream:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
