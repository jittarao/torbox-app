import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

// Get user notifications
export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return Response.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/notifications/mynotifications`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
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

// Clear all notifications or test notifications
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { action } = await request.json();

  if (!apiKey) {
    return Response.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  try {
    let endpoint;
    let method = 'POST';

    switch (action) {
      case 'clear_all':
        endpoint = '/api/notifications/clear';
        break;
      case 'test':
        endpoint = '/api/notifications/test';
        break;
      default:
        return Response.json(
          { success: false, error: 'Invalid action' },
          { status: 400 },
        );
    }

    const response = await fetch(`${API_BASE}/${API_VERSION}${endpoint}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    });

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
