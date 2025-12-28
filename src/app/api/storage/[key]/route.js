import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET(request, { params }) {
  try {
    const { key } = params;
    
    // Validate key to prevent path traversal
    if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'Invalid key format' },
        { status: 400 }
      );
    }
    
    const response = await fetch(`${BACKEND_URL}/api/storage/${key}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error fetching storage value for key ${params.key}:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { key } = params;
    
    // Validate key to prevent path traversal
    if (!key || key.includes('..') || key.includes('/') || key.includes('\\')) {
      return NextResponse.json(
        { success: false, error: 'Invalid key format' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    const response = await fetch(`${BACKEND_URL}/api/storage/${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json(data);
    } else {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
  } catch (error) {
    console.error(`Error saving storage value for key ${params.key}:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
