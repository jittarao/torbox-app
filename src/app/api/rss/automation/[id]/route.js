import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { NextResponse } from 'next/server';

// Delete an automation rule
export async function DELETE(request, { params }) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = params;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/rss/automation/rules/${id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        {
          success: false,
          error: errorData.error || errorData.detail || 'Failed to delete automation rule',
        },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error deleting RSS automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
