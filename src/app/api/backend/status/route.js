import { NextResponse } from 'next/server';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET() {
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
    console.log('Backend not available:', error.message);
    // Backend not available, return local mode
    return NextResponse.json({ 
      available: false, 
      mode: 'local',
      version: '0.1.0',
      uptime: 0
    });
  }
}
