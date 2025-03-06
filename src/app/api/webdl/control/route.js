import { NextResponse } from 'next/server';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function POST(request) {
  try {
    const { apiKey, action, id } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 },
      );
    }

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 },
      );
    }

    if (!id && action !== 'create') {
      return NextResponse.json(
        { error: 'Web download ID is required' },
        { status: 400 },
      );
    }

    const apiUrl = `${API_BASE}/${API_VERSION}/api/webdl/controlwebdownload`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      body: JSON.stringify({
        web_id: id,
        operation: action,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || `API responded with status: ${response.status}`,
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error controlling web download:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
