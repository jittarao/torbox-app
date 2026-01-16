import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// DELETE /api/uploads/bulk - Bulk delete uploads
export async function DELETE(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Upload logs feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/uploads/bulk`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ids }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error bulk deleting uploads:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/uploads/bulk/retry - Bulk retry failed uploads
export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Upload logs feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/uploads/bulk/retry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ids }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error bulk retrying uploads:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
