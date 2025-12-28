import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';

export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { 
        status: 'no-api-key',
        message: 'API key is required to check TorBox connectivity',
        timestamp: new Date().toISOString()
      },
      { status: 400 }
    );
  }

  try {
    // Test TorBox API connectivity with a simple request
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/torrents/mylist?limit=1`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    if (response.ok) {
      return NextResponse.json(
        { 
          status: 'healthy',
          message: 'TorBox API is responding normally',
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - Date.now() // Placeholder for actual timing
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          message: `TorBox API responded with status: ${response.status}`,
          timestamp: new Date().toISOString(),
          statusCode: response.status
        },
        { status: 200 } // Return 200 to indicate our endpoint is working
      );
    }
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'unhealthy',
        message: error.message,
        timestamp: new Date().toISOString(),
        error: error.name
      },
      { status: 200 } // Return 200 to indicate our endpoint is working
    );
  }
}
