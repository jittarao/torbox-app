import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

// Clear a specific notification by ID
export async function POST(request, { params }) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = params;

  if (!apiKey) {
    return Response.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  if (!id) {
    return Response.json(
      { success: false, error: 'Notification ID is required' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/notifications/clear/${id}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
