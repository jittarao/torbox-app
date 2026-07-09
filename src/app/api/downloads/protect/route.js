import { NextResponse } from 'next/server';
import { isBackendDisabled } from '@/utils/backendCheck';
import { backendFetch } from '@/utils/backendRequest';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { sanitizeError } from '@/utils/sanitizeError';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET() {
  if (isBackendDisabled()) {
    return NextResponse.json({ success: true, protected_ids: [] });
  }

  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;

  try {
    const response = await backendFetch(`${BACKEND_URL}/api/downloads/protect`, {
      apiKey: auth.apiKey,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.error || 'Failed to fetch protected downloads' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching protected downloads from backend:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request) {
  if (isBackendDisabled()) {
    return NextResponse.json(
      { success: false, error: 'Protected downloads feature is disabled when backend is disabled' },
      { status: 503 }
    );
  }

  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;

  try {
    const body = await request.json();

    const response = await backendFetch(`${BACKEND_URL}/api/downloads/protect`, {
      apiKey: auth.apiKey,
      method: 'PUT',
      body,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${response.status}`,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating protected downloads in backend:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
