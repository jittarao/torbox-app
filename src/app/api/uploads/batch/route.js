import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

// POST /api/uploads/batch - Batch create uploads (efficient for large batches)
export async function POST(request) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { uploads } = body;

    if (!Array.isArray(uploads) || uploads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'uploads array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (uploads.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Maximum 1000 uploads per batch request' },
        { status: 400 }
      );
    }

    // First, upload all files in parallel (if any)
    const fileUploadPromises = uploads
      .filter((upload) => upload.upload_type === 'file' && upload.file_data)
      .map(async (upload) => {
        const fileUploadResponse = await fetch(`${BACKEND_URL}/api/uploads/file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({
            file_data: upload.file_data,
            filename: upload.filename,
            type: upload.type,
          }),
        });

        if (!fileUploadResponse.ok) {
          const errorData = await fileUploadResponse.json().catch(() => ({}));
          return { upload, error: errorData.error || 'Failed to save file' };
        }

        const fileUploadData = await fileUploadResponse.json();
        return { upload, file_path: fileUploadData.data.file_path };
      });

    const fileUploadResults = await Promise.all(fileUploadPromises);

    // Map file paths back to uploads
    const filePathMap = new Map();
    const fileUploadErrors = [];
    fileUploadResults.forEach((result) => {
      if (result.error) {
        fileUploadErrors.push(result);
      } else {
        filePathMap.set(result.upload, result.file_path);
      }
    });

    // Prepare uploads for batch endpoint (remove file_data, add file_path)
    const preparedUploads = uploads.map((upload) => {
      const prepared = { ...upload };
      if (upload.upload_type === 'file') {
        if (filePathMap.has(upload)) {
          prepared.file_path = filePathMap.get(upload);
        }
        delete prepared.file_data;
        delete prepared.filename;
      }
      return prepared;
    });

    // Create batch upload entries
    const response = await fetch(`${BACKEND_URL}/api/uploads/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ uploads: preparedUploads }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    // Merge file upload errors with batch errors
    if (fileUploadErrors.length > 0 && data.data?.errors) {
      data.data.errors = [...fileUploadErrors, ...data.data.errors];
    } else if (fileUploadErrors.length > 0) {
      data.data = data.data || {};
      data.data.errors = fileUploadErrors;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error creating batch upload:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
