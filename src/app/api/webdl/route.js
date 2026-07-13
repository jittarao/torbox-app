import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { headers } from 'next/headers';
import { safeJsonParse } from '@/utils/safeJsonParse';
import {
  buildListSyncResponse,
  handleListSyncRequest,
  patchCacheRemoveIds,
} from '@/app/api/lib/downloadListSync';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { sanitizeError } from '@/utils/sanitizeError';
import { guardDestructiveOrRespond } from '@/app/api/lib/downloadProtectionGuard';

const CACHE_TYPE = 'webdl';

const CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  Pragma: 'no-cache',
  Expires: '0',
  Vary: 'Authorization, x-api-key',
};

// Get all web downloads
export async function GET(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;
  const apiKey = auth.apiKey;
  const { searchParams } = new URL(request.url);
  const revRaw = searchParams.get('rev');
  const rev = revRaw != null && revRaw !== '' ? Number(revRaw) : null;
  const bypassCache = request.headers.get('bypass-cache') === 'true';
  const forceListSync = request.headers.get('x-force-list-sync') === 'true';

  try {
    const result = await handleListSyncRequest({
      apiKey,
      type: CACHE_TYPE,
      rev: Number.isInteger(rev) ? rev : null,
      bypassCache,
      forceListSync,
    });

    return buildListSyncResponse(result, CACHE_HEADERS);
  } catch (error) {
    console.error('Error fetching web download data:', error);
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
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
      cache: 'no-store',
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
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

// Delete a web download item
export async function DELETE(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { id } = await request.json();

  try {
    const blocked = await guardDestructiveOrRespond(apiKey, [id], 'delete');
    if (blocked) return blocked;

    // First, fetch the webdl data to determine if it's queued
    const [downloadsResponse, queuedResponse] = await Promise.all([
      torboxFetch(`${API_BASE}/${API_VERSION}/api/webdl/mylist?id=${id}`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }),
      torboxFetch(`${API_BASE}/${API_VERSION}/api/queued/getqueued?type=webdl`, {
        cache: 'no-store',
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

    const response = await torboxFetch(endpoint, {
      cache: 'no-store',
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

    await patchCacheRemoveIds(apiKey, CACHE_TYPE, [id]);

    return Response.json(data);
  } catch (error) {
    return Response.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
