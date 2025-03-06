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
  const usenetId = searchParams.get('usenet_id');
  const fileId = searchParams.get('file_id');
  const zipLink = searchParams.get('zip_link') === 'true';

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 400 },
    );
  }

  if (!usenetId) {
    return NextResponse.json(
      { success: false, error: 'Usenet ID is required' },
      { status: 400 },
    );
  }

  try {
    const queryParams = new URLSearchParams({
      token: apiKey,
      usenet_id: usenetId,
      ...(fileId && { file_id: fileId }),
      ...(zipLink && { zip_link: zipLink }),
    });
    const apiUrl = `${API_BASE}/${API_VERSION}/api/usenet/requestdl?${queryParams}`;
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching usenet download link:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
