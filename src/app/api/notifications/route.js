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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
    
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/notifications/mynotifications`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        signal: controller.signal,
      },
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Response.json(
        { success: false, error: errorData.detail || `HTTP ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      return Response.json(
        { success: false, error: 'Request timeout - connection to TorBox API failed' },
        { status: 408 },
      );
    }
    
    if (error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT') {
      return Response.json(
        { success: false, error: 'Connection timeout - TorBox API is unreachable' },
        { status: 408 },
      );
    }
    
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

    const requestOptions = {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    };

    // Only add Content-Type and body for clear_all action
    if (action === 'clear_all') {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify({});
    }

    const response = await fetch(`${API_BASE}/${API_VERSION}${endpoint}`, requestOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Response.json(
        { success: false, error: errorData.detail || `HTTP ${response.status}` },
        { status: response.status },
      );
    }

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    console.error('Error with notification action:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
