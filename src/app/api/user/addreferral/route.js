import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';

export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 401 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const referral = body.referral || body.referral_code;
  if (!referral) {
    return NextResponse.json(
      { success: false, error: 'MISSING_REQUIRED_OPTION', detail: 'referral code is required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/user/addreferral?referral=${encodeURIComponent(referral)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: JSON.stringify({ referral }),
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `API responded with status: ${response.status}`,
          detail: data.detail || 'Failed to add referral code',
        },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error adding referral:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
