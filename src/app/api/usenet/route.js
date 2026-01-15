import { headers } from 'next/headers';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { NextResponse } from 'next/server';
import { safeJsonParse } from '@/utils/safeJsonParse';

// Get all usenet downloads
export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  // Always bypass cache for user-specific data to prevent cross-user contamination
  const bypassCache = true;

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  try {
    // Add timestamp to force cache bypass
    const timestamp = Date.now();

    // Fetch both regular and queued usenet downloads in parallel
    const [downloadsResponse, queuedResponse] = await Promise.all([
      fetch(`${API_BASE}/${API_VERSION}/api/usenet/mylist?bypass_cache=true&_t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=usenet&bypass_cache=true&_t=${timestamp}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        }
      ),
    ]);

    if (!downloadsResponse.ok || !queuedResponse.ok) {
      throw new Error(`API responded with status: ${downloadsResponse.status}`);
    }

    const [downloadsData, queuedData] = await Promise.all([
      downloadsResponse.json(),
      queuedResponse.json(),
    ]);

    // Merge the data
    const mergedData = {
      success: downloadsData.success && queuedData.success,
      data: [...(downloadsData.data || []), ...(queuedData.data || [])],
    };

    return NextResponse.json(mergedData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
        Vary: 'Authorization', // Ensure cache varies by user
      },
    });
  } catch (error) {
    console.error('Error fetching usenet data:', error);

    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to fetch usenet data';
    let statusCode = 500;

    if (error.message.includes('502')) {
      errorMessage =
        'TorBox servers are temporarily unavailable. Please try again in a few minutes.';
      statusCode = 502;
    } else if (error.message.includes('503')) {
      errorMessage =
        'TorBox servers are temporarily overloaded. Please try again in a few minutes.';
      statusCode = 503;
    } else if (error.message.includes('504')) {
      errorMessage =
        'TorBox servers are taking too long to respond. Please try again in a few minutes.';
      statusCode = 504;
    } else if (
      error.message.includes('NetworkError') ||
      error.message.includes('Failed to fetch')
    ) {
      errorMessage =
        'Unable to connect to TorBox servers. Please check your internet connection and try again.';
      statusCode = 503;
    } else if (error.message.includes('401')) {
      errorMessage = 'Authentication failed. Please check your API key.';
      statusCode = 401;
    } else if (error.message.includes('403')) {
      errorMessage = 'Access denied. Please check your API key and account status.';
      statusCode = 403;
    }

    return NextResponse.json(
      {
        error: errorMessage,
        originalError: error.message,
      },
      { status: statusCode }
    );
  }
}

// Create a new usenet download (queued upload)
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const formData = await request.formData();

  const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

  try {
    // Extract data from formData
    const file = formData.get('file');
    const link = formData.get('link');
    const name = formData.get('name');

    // Determine upload type
    let upload_type;
    let file_path = null;
    let url = null;

    if (link) {
      upload_type = 'link';
      url = link;
    } else if (file) {
      upload_type = 'file';
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const file_data = buffer.toString('base64');

      // Upload file to backend storage
      const fileUploadResponse = await fetch(`${BACKEND_URL}/api/uploads/file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          file_data,
          filename: file.name,
          type: 'usenet',
        }),
      });

      if (!fileUploadResponse.ok) {
        const errorData = await fileUploadResponse.json().catch(() => ({}));
        return Response.json(
          {
            success: false,
            error: errorData.error || 'Failed to save file',
          },
          { status: fileUploadResponse.status }
        );
      }

      const fileUploadData = await fileUploadResponse.json();
      file_path = fileUploadData.data.file_path;
    } else {
      return Response.json({ success: false, error: 'file or link is required' }, { status: 400 });
    }

    // Create upload entry in backend
    const uploadResponse = await fetch(`${BACKEND_URL}/api/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        type: 'usenet',
        upload_type,
        file_path,
        url,
        name: name || (file ? file.name : 'Unknown'),
      }),
    });

    const uploadData = await safeJsonParse(uploadResponse);

    if (!uploadResponse.ok) {
      return Response.json(
        {
          success: false,
          error: uploadData.error || `Backend responded with status: ${uploadResponse.status}`,
          detail: uploadData.detail,
        },
        { status: uploadResponse.status }
      );
    }

    // Return success immediately (upload is queued)
    return Response.json({
      success: true,
      message: 'Upload queued successfully',
      data: uploadData.data,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Delete a usenet item
export async function DELETE(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = await request.json();

  try {
    // First, fetch the usenet data to determine if it's queued
    const [downloadsResponse, queuedResponse] = await Promise.all([
      fetch(`${API_BASE}/${API_VERSION}/api/usenet/mylist?id=${id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
      fetch(`${API_BASE}/${API_VERSION}/api/queued/getqueued?type=usenet`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
    ]);

    const [downloadsData, queuedData] = await Promise.all([
      downloadsResponse.json(),
      queuedResponse.json(),
    ]);

    // Check if the usenet item is in the queued list
    const isQueued = queuedData.data?.some((item) => item.id === id);

    // Use appropriate endpoint based on whether usenet item is queued
    const endpoint = isQueued
      ? `${API_BASE}/${API_VERSION}/api/queued/controlqueued`
      : `${API_BASE}/${API_VERSION}/api/usenet/controlusenetdownload`;

    const body = isQueued
      ? JSON.stringify({
          queued_id: id,
          operation: 'delete',
          type: 'usenet',
        })
      : JSON.stringify({
          usenet_id: id,
          operation: 'delete',
        });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      body,
    });

    const data = await safeJsonParse(response);

    if (!response.ok) {
      return Response.json(
        {
          success: false,
          error: data.error || `API responded with status: ${response.status}`,
          detail: data.detail,
        },
        { status: response.status }
      );
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
