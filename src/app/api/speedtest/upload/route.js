import { NextResponse } from 'next/server';
import { sanitizeError } from '@/utils/sanitizeError';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';

const MAX_SPEEDTEST_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request) {
  try {
    const auth = await requireTorboxApiKey();
    if (auth.response) {
      return auth.response;
    }

    const contentLength = request.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_SPEEDTEST_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File size exceeds the ${MAX_SPEEDTEST_FILE_SIZE_BYTES / 1024 / 1024} MB limit` },
        { status: 400 }
      );
    }

    // This endpoint is just for measuring upload time
    // We don't actually need to store the file
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_SPEEDTEST_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File size exceeds the ${MAX_SPEEDTEST_FILE_SIZE_BYTES / 1024 / 1024} MB limit` },
        { status: 400 }
      );
    }

    // Simulate some processing time to make the upload test more realistic
    await new Promise((resolve) => setTimeout(resolve, 100));

    return NextResponse.json({
      success: true,
      message: 'Upload test completed',
      fileSize: file.size,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
