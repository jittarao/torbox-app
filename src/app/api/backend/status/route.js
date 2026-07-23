import { NextResponse } from 'next/server';

import { isBackendDisabled } from '@/utils/backendCheck';
import { backendHttpGet } from '@/utils/backendRequest';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET() {
  // Check if backend is explicitly disabled
  if (isBackendDisabled()) {
    return NextResponse.json({
      available: false,
      mode: 'local',
      version: '0.1.0',
      uptime: 0,
    });
  }

  try {
    const url = new URL(`${BACKEND_URL}/api/backend/status`);

    const response = await backendHttpGet(url);

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      // Backend not available, return local mode
      return NextResponse.json({
        available: false,
        mode: 'local',
        version: '0.1.0',
        uptime: 0,
      });
    }
  } catch (error) {
    // Only log once per session to avoid spam
    if (!global.backendStatusLogged) {
      console.log('Backend not available, using local storage mode');
      global.backendStatusLogged = true;
    }
    // Backend not available, return local mode
    return NextResponse.json({
      available: false,
      mode: 'local',
      version: '0.1.0',
      uptime: 0,
    });
  }
}
