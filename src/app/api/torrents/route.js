import { headers } from 'next/headers';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getCached, setCached, computeDelta } from '@/app/api/lib/deltaListCache';

const CACHE_TYPE = 'torrents';

// Get all torrents
export async function GET(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const delta = searchParams.get('delta') === '1';
  const cursor = searchParams.get('cursor');

  try {
    // Add timestamp to force cache bypass
    const timestamp = Date.now();

    // Fetch both regular and queued torrents in parallel with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const [torrentsResponse, queuedResponse] = await Promise.all([
      fetch(`${API_BASE}/${API_VERSION}/api/torrents/mylist?bypass_cache=true&_t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
        signal: controller.signal,
      }),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=torrent&bypass_cache=true&_t=${timestamp}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
          signal: controller.signal,
        }
      ),
    ]);

    clearTimeout(timeoutId);

    const [torrentsData, queuedData] = await Promise.all([
      torrentsResponse.json(),
      queuedResponse.json(),
    ]);

    // Merge the data
    const mergedData = {
      success: torrentsData.success && queuedData.success,
      data: [...(torrentsData.data || []), ...(queuedData.data || [])],
    };

    const cacheHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      Vary: 'Authorization',
    };

    if (delta && cursor && apiKey) {
      const cached = getCached(apiKey, CACHE_TYPE);
      if (cached) {
        const deltaResult = computeDelta(cached.data, mergedData.data);
        const newCursor = setCached(apiKey, CACHE_TYPE, mergedData.data);
        const payload = {
          success: mergedData.success,
          delta: true,
          data: deltaResult.data,
          cursor: newCursor,
        };
        if (deltaResult.removed.length > 0) {
          payload.removed = deltaResult.removed;
        }
        return Response.json(payload, { headers: cacheHeaders });
      }
    }

    if (apiKey) {
      const newCursor = setCached(apiKey, CACHE_TYPE, mergedData.data);
      return Response.json(
        { ...mergedData, cursor: newCursor },
        { headers: cacheHeaders }
      );
    }
    return Response.json(mergedData, { headers: cacheHeaders });
  } catch (error) {
    console.error('Error fetching torrents:', error);

    // Handle timeout specifically
    if (error.name === 'AbortError') {
      return Response.json(
        {
          success: false,
          error: 'Request timeout - API took longer than 30 seconds to respond',
        },
        { status: 408 }
      );
    }

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Create a new torrent (queued upload)
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const formData = await request.formData();

  const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

  try {
    // Extract data from formData
    const file = formData.get('file');
    const magnet = formData.get('magnet');
    const link = formData.get('link');
    const seed = formData.get('seed');
    const allowZip = formData.get('allow_zip');
    const asQueued = formData.get('as_queued');
    const name = formData.get('name');

    // Determine upload type
    let upload_type;
    let file_path = null;
    let url = null;

    if (magnet) {
      upload_type = 'magnet';
      url = magnet;
    } else if (link) {
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
          type: 'torrent',
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
      return Response.json(
        { success: false, error: 'file, magnet, or link is required' },
        { status: 400 }
      );
    }

    // Get authId from backend (hash of API key)
    // For now, we'll pass the API key and let backend hash it
    // Create upload entry in backend
    const requestBody = {
      type: 'torrent',
      upload_type,
      file_path,
      url,
      name: name || (file ? file.name : 'Unknown'),
      seed: seed ? parseInt(seed, 10) : null,
      allow_zip: allowZip === 'true' || allowZip === true,
    };

    // Only include as_queued if it's true
    if (asQueued === 'true' || asQueued === true) {
      requestBody.as_queued = true;
    }

    const uploadResponse = await fetch(`${BACKEND_URL}/api/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const uploadData = await safeJsonParse(uploadResponse);

    if (!uploadResponse.ok) {
      // Clean up uploaded file if queue entry creation failed
      if (file_path && upload_type === 'file') {
        try {
          await fetch(`${BACKEND_URL}/api/uploads/file`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
            },
            body: JSON.stringify({ file_path }),
          });
        } catch (cleanupError) {
          console.error('Error cleaning up file after queue entry creation failure:', cleanupError);
          // Continue even if cleanup fails - log error but don't fail the response
        }
      }

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

// Delete a torrent
export async function DELETE(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = await request.json();

  try {
    // First, fetch the torrent data to determine if it's queued
    const [torrentsResponse, queuedResponse] = await Promise.all([
      fetch(`${API_BASE}/${API_VERSION}/api/torrents/mylist?id=${id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
      fetch(`${API_BASE}/${API_VERSION}/api/queued/getqueued?type=torrent`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
    ]);

    const [torrentsData, queuedData] = await Promise.all([
      safeJsonParse(torrentsResponse),
      safeJsonParse(queuedResponse),
    ]);

    // Check if the torrent is in the queued list
    const isQueued = queuedData.data?.some((item) => item.id === id);

    // Use appropriate endpoint based on whether torrent is queued
    const endpoint = isQueued
      ? `${API_BASE}/${API_VERSION}/api/queued/controlqueued`
      : `${API_BASE}/${API_VERSION}/api/torrents/controltorrent`;

    const body = isQueued
      ? JSON.stringify({
          queued_id: id,
          operation: 'delete',
          type: 'torrent',
        })
      : JSON.stringify({
          torrent_id: id,
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
