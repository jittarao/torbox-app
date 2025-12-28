import { NextResponse } from 'next/server';
import http from 'http';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function PUT(request, { params }) {
  try {
    const { id } = params;
    const body = await request.json();
    const url = new URL(`${BACKEND_URL}/api/automation/rules/${id}`);

    const response = await new Promise((resolve, reject) => {
      const putData = JSON.stringify(body);
      const req = http.request(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(putData)
        },
        timeout: 5000
      }, (res) => {
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
      req.write(putData);
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error updating automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    const url = new URL(`${BACKEND_URL}/api/automation/rules/${id}`);

    const response = await new Promise((resolve, reject) => {
      const req = http.request(url, {
        method: 'DELETE',
        timeout: 5000
      }, (res) => {
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
      req.end();
    });

    if (response.ok) {
      return NextResponse.json(response.data);
    } else {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting automation rule:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
