import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION } from '@/components/constants';

export async function POST(request) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const { queued_id, operation, type } = await request.json();

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/queued/controlqueued`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ queued_id, operation, type }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.message },
        { status: response.status },
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
