import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const headersList = await headers();
    
    // Try to get IP from various headers (common in proxy setups)
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const clientIp = headersList.get('x-client-ip');
    const cfConnectingIp = headersList.get('cf-connecting-ip'); // Cloudflare
    
    // Get the first IP from x-forwarded-for (it can contain multiple IPs)
    const ip = forwardedFor?.split(',')[0]?.trim() || 
               realIp || 
               clientIp || 
               cfConnectingIp || 
               'unknown';

    return NextResponse.json({
      success: true,
      ip: ip,
      headers: {
        'x-forwarded-for': forwardedFor,
        'x-real-ip': realIp,
        'x-client-ip': clientIp,
        'cf-connecting-ip': cfConnectingIp,
      }
    });
  } catch (error) {
    console.error('Error getting IP:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        ip: 'unknown'
      },
      { status: 500 }
    );
  }
}
