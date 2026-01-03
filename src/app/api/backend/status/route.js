import { NextResponse } from 'next/server';
import http from 'http';
import { isMultiUserBackendEnabled } from '@/utils/backendConfig';
import { getDatabase } from '@/database/db';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET() {
  // Check if multi-user backend is enabled
  const multiUserBackendEnabled = isMultiUserBackendEnabled();
  
  // Check if legacy backend is explicitly disabled
  if (process.env.BACKEND_DISABLED === 'true' && !multiUserBackendEnabled) {
    return NextResponse.json({ 
      available: false, 
      mode: 'local',
      version: '0.1.0',
      uptime: 0,
      multiUserBackend: false
    });
  }
  
  // If multi-user backend is enabled, check database availability
  if (multiUserBackendEnabled) {
    const db = getDatabase();
    if (db && db.isInitialized) {
      return NextResponse.json({
        available: true,
        mode: 'backend',
        version: '0.1.27',
        uptime: process.uptime(),
        multiUserBackend: true,
        database: 'connected'
      });
    } else {
      return NextResponse.json({
        available: false,
        mode: 'local',
        version: '0.1.27',
        uptime: 0,
        multiUserBackend: true,
        database: 'disconnected',
        error: 'Database not initialized'
      });
    }
  }

  try {
    const url = new URL(`${BACKEND_URL}/api/backend/status`);
    
    const response = await new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({ ok: res.statusCode === 200, data: jsonData });
          } catch (parseError) {
            reject(parseError);
          }
        });
      });
      
      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      // Backend not available, return local mode
      return NextResponse.json({ 
        available: false, 
        mode: 'local',
        version: '0.1.0',
        uptime: 0
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
      uptime: 0
    });
  }
}
