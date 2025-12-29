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
    const startTime = Date.now();
    // Test TorBox API connectivity using the UP endpoint
    const response = await fetch(
      API_BASE,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      }
    );

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      // Check if the UP endpoint returned the expected success response
      if (data.success === true) {
        return NextResponse.json(
          { 
            status: 'healthy',
            message: data.detail || 'TorBox API is responding normally',
            timestamp: new Date().toISOString(),
            responseTime
          },
          { status: 200 }
        );
      } else {
        return NextResponse.json(
          { 
            status: 'unhealthy',
            message: data.detail || 'TorBox API UP endpoint returned unexpected response',
            timestamp: new Date().toISOString(),
            responseTime
          },
          { status: 200 } // Return 200 to indicate our endpoint is working
        );
      }
    } else {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          message: `TorBox API responded with status: ${response.status}`,
          timestamp: new Date().toISOString(),
          statusCode: response.status,
          responseTime
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
