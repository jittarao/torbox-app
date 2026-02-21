import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { headers } from 'next/headers';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { getCached, setCached, computeDelta } from '@/app/api/lib/deltaListCache';

const CACHE_TYPE = 'webdl';

// Get all web downloads
export async function GET(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(request.url);
  const delta = searchParams.get('delta') === '1';
  const cursor = searchParams.get('cursor');

  if (!apiKey) {
    return NextResponse.json({ error: 'API key is required' }, { status: 400 });
  }

  try {
    // Add timestamp to force cache bypass
    const timestamp = Date.now();

    // Fetch both regular and queued web downloads in parallel
    const [downloadsResponse, queuedResponse] = await Promise.all([
      fetch(`${API_BASE}/${API_VERSION}/api/webdl/mylist?bypass_cache=true&_t=${timestamp}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=webdl&bypass_cache=true&_t=${timestamp}`,
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

    const cacheHeaders = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      Vary: 'Authorization',
    };

    if (delta && cursor) {
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
        return NextResponse.json(payload, { headers: cacheHeaders });
      }
    }

    const newCursor = setCached(apiKey, CACHE_TYPE, mergedData.data);
    return NextResponse.json(
      { ...mergedData, cursor: newCursor },
      { headers: cacheHeaders }
    );
  } catch (error) {
    console.error('Error fetching web download data:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Create a web download (queued upload)
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
  }

  const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

  try {
    const formData = await request.formData();

    // Extract data from formData
    const link = formData.get('link');
    const password = formData.get('password');
    const name = formData.get('name');

    if (!link) {
      return NextResponse.json({ success: false, error: 'link is required' }, { status: 400 });
    }

    // Create upload entry in backend
    const uploadResponse = await fetch(`${BACKEND_URL}/api/uploads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        type: 'webdl',
        upload_type: 'link',
        url: link,
        name: name || 'Unknown',
        password: password || null,
      }),
    });

    const uploadData = await safeJsonParse(uploadResponse);

    if (!uploadResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: uploadData.error || `Backend responded with status: ${uploadResponse.status}`,
          detail: uploadData.detail,
        },
        { status: uploadResponse.status }
      );
    }

    // Return success immediately (upload is queued)
    return NextResponse.json({
      success: true,
      message: 'Upload queued successfully',
      data: uploadData.data,
    });
  } catch (error) {
    console.error('Error creating web download:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Delete a web download item
export async function DELETE(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = await request.json();

  try {
    // First, fetch the webdl data to determine if it's queued
    const [downloadsResponse, queuedResponse] = await Promise.all([
      fetch(`${API_BASE}/${API_VERSION}/api/webdl/mylist?id=${id}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
      fetch(`${API_BASE}/${API_VERSION}/api/queued/getqueued?type=webdl`, {
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

    // Check if the webdl item is in the queued list
    const isQueued = queuedData.data?.some((item) => item.id === id);

    // Use appropriate endpoint based on whether webdl item is queued
    const endpoint = isQueued
      ? `${API_BASE}/${API_VERSION}/api/queued/controlqueued`
      : `${API_BASE}/${API_VERSION}/api/webdl/controlwebdownload`;

    const body = isQueued
      ? JSON.stringify({
          queued_id: id,
          operation: 'delete',
          type: 'webdl',
        })
      : JSON.stringify({
          webdl_id: id,
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
