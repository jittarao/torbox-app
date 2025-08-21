import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

// Get all torrents
export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const bypassCache = headersList.get('bypass-cache') === 'true';

  try {
    // Fetch both regular and queued torrents in parallel
    const [torrentsResponse, queuedResponse] = await Promise.all([
      fetch(
        `${API_BASE}/${API_VERSION}/api/torrents/mylist${bypassCache ? '?bypass_cache=true' : ''}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=torrent${bypassCache ? '&bypass_cache=true' : ''}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
    ]);

    const [torrentsData, queuedData] = await Promise.all([
      torrentsResponse.json(),
      queuedResponse.json(),
    ]);

    // Merge the data
    const mergedData = {
      success: torrentsData.success && queuedData.success,
      data: [...(torrentsData.data || []), ...(queuedData.data || [])],
    };

    return Response.json(mergedData);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

// Create a new torrent
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const formData = await request.formData();

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/torrents/createtorrent`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
        body: formData,
      },
    );

    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
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
      fetch(
        `${API_BASE}/${API_VERSION}/api/torrents/mylist?id=${id}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=torrent`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
    ]);

    const [torrentsData, queuedData] = await Promise.all([
      torrentsResponse.json(),
      queuedResponse.json(),
    ]);

    // Check if the torrent is in the queued list
    const isQueued = queuedData.data?.some(item => item.id === id);
    
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
    
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
