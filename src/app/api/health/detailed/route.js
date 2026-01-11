import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET() {
  // Restrict to development environment only for security
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      {
        status: 'forbidden',
        error: 'This endpoint is only available in development environment',
        timestamp: new Date().toISOString()
      },
      { status: 403 }
    );
  }

  // Check if backend is explicitly disabled
  if (process.env.BACKEND_DISABLED === 'true') {
    return NextResponse.json(
      {
        status: 'unavailable',
        message: 'Backend is disabled',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/health/detailed`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      // If backend returns an error status, still return the response data
      const errorData = await response.json().catch(() => ({
        status: 'unhealthy',
        error: `Backend returned status ${response.status}`,
        timestamp: new Date().toISOString()
      }));

      return NextResponse.json(errorData, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    // Handle network errors, timeouts, etc.
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Backend health check request timed out',
          timestamp: new Date().toISOString(),
          backendUrl: BACKEND_URL
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error.message || 'Failed to connect to backend',
        timestamp: new Date().toISOString(),
        backendUrl: BACKEND_URL
      },
      { status: 503 }
    );
  }
}
