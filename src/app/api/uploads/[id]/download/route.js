import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// GET /api/uploads/[id]/download - Download original file
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/uploads/${id}/download`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    // Get the filename from Content-Disposition header or use a default
    const contentDisposition = response.headers.get('Content-Disposition');
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    
    const fileBuffer = await response.arrayBuffer();

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition || 'attachment',
      },
    });
  } catch (error) {
    console.error('Error downloading upload file:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
