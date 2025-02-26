import { headers } from 'next/headers';
import { API_BASE, API_VERSION } from '@/components/constants';

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
          },
        },
      ),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=torrent${bypassCache ? '&bypass_cache=true' : ''}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
    // Make sure we're sending the right form data to the API
    const apiFormData = new FormData();

    // Copy all fields from the request formData
    for (const [key, value] of formData.entries()) {
      // Handle special cases for compatibility
      if (key === 'file' || key === 'url' || key === 'magnet') {
        apiFormData.append(key, value);
      } else if (key === 'seed') {
        apiFormData.append('seed', value);
      } else if (key === 'allowZip') {
        apiFormData.append('allow_zip', value);
      } else if (key === 'asQueued') {
        apiFormData.append('as_queued', value);
      } else {
        // Pass through any other fields
        apiFormData.append(key, value);
      }
    }

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/torrents/createtorrent`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: apiFormData,
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
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/torrents/controltorrent`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          torrent_id: id,
          operation: 'delete',
        }),
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
