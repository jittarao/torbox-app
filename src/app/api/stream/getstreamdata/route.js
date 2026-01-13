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
  const presignedToken = searchParams.get('presigned_token');
  const token = searchParams.get('token');
  const id = searchParams.get('id');
  const fileId = searchParams.get('file_id');
  const type = searchParams.get('type');
  const chosenSubtitleIndex = searchParams.get('chosen_subtitle_index');
  const chosenAudioIndex = searchParams.get('chosen_audio_index') || '0';

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 400 },
    );
  }

  try {
    let queryParams;
    
    // Check if we're using token mode or itemId/fileId mode
    if (presignedToken && token) {
      // Original mode: using presignedToken and token
      queryParams = new URLSearchParams({
        presigned_token: presignedToken,
        token: token,
        ...(chosenSubtitleIndex !== null && chosenSubtitleIndex !== undefined && { chosen_subtitle_index: chosenSubtitleIndex }),
        chosen_audio_index: chosenAudioIndex,
      });
    } else if (id && fileId) {
      // New mode: using itemId, fileId, and type to get metadata
      queryParams = new URLSearchParams({
        id: id,
        file_id: fileId,
        type: type || 'torrent',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Either (presigned_token and token) or (id and file_id) are required' },
        { status: 400 },
      );
    }
    
    const apiUrl = `${API_BASE}/${API_VERSION}/api/stream/getstreamdata?${queryParams}`;
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
    console.error('Error getting stream data:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
