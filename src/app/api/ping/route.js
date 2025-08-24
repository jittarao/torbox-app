import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { domain } = await request.json();
    
    if (!domain) {
      return NextResponse.json(
        { success: false, error: 'Domain is required' },
        { status: 400 }
      );
    }

    // Server-side ping test
    const startTime = Date.now();
    
    try {
      const response = await fetch(domain, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'TorBoxManager/1.0',
        },
      });
      
      const endTime = Date.now();
      const pingTime = endTime - startTime;
      
      return NextResponse.json({
        success: true,
        ping: pingTime,
        status: response.status,
        domain: domain
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Ping failed',
        domain: domain,
        details: error.message
      });
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
