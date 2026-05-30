import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { sanitizeError } from '@/utils/sanitizeError';
export async function POST(request) {
  try {
    const { apiKey, action, id } = await request.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (!id && action !== 'create') {
      return NextResponse.json({ error: 'Usenet ID is required' }, { status: 400 });
    }

    const apiUrl = `${API_BASE}/${API_VERSION}/api/usenet/controlusenetdownload`;

    const response = await torboxFetch(apiUrl, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      body: JSON.stringify({
        usenet_id: id,
        operation: action,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error controlling usenet download:', error);
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
