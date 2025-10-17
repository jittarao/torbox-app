import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { NextResponse } from 'next/server';

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
      fetch(
        `${API_BASE}/${API_VERSION}/api/usenet/mylist?bypass_cache=true&_t=${timestamp}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        },
      ),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=usenet&bypass_cache=true&_t=${timestamp}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        },
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
        'Pragma': 'no-cache',
        'Expires': '0',
        'Vary': 'Authorization', // Ensure cache varies by user
      },
    });
  } catch (error) {
    console.error('Error fetching usenet data:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to fetch usenet data';
    let statusCode = 500;
    
    if (error.message.includes('502')) {
      errorMessage = 'TorBox servers are temporarily unavailable. Please try again in a few minutes.';
      statusCode = 502;
    } else if (error.message.includes('503')) {
      errorMessage = 'TorBox servers are temporarily overloaded. Please try again in a few minutes.';
      statusCode = 503;
    } else if (error.message.includes('504')) {
      errorMessage = 'TorBox servers are taking too long to respond. Please try again in a few minutes.';
      statusCode = 504;
    } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      errorMessage = 'Unable to connect to TorBox servers. Please check your internet connection and try again.';
      statusCode = 503;
    } else if (error.message.includes('401')) {
      errorMessage = 'Authentication failed. Please check your API key.';
      statusCode = 401;
    } else if (error.message.includes('403')) {
      errorMessage = 'Access denied. Please check your API key and account status.';
      statusCode = 403;
    }
    
    return NextResponse.json({ 
      error: errorMessage,
      originalError: error.message 
    }, { status: statusCode });
  }
}

// Create a new usenet download
export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const formData = await request.formData();

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/usenet/createusenetdownload`,
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

    if (!response.ok || !data.success) {
      // Provide more specific error messages based on the response
      let errorMessage = data.detail || 'Failed to add NZB';
      let statusCode = response.status || 400;
      
      if (response.status === 502) {
        errorMessage = 'TorBox servers are temporarily unavailable. Please try again in a few minutes.';
      } else if (response.status === 503) {
        errorMessage = 'TorBox servers are temporarily overloaded. Please try again in a few minutes.';
      } else if (response.status === 504) {
        errorMessage = 'TorBox servers are taking too long to respond. Please try again in a few minutes.';
      } else if (response.status === 429) {
        errorMessage = 'Too many requests to TorBox servers. Please wait a moment and try again.';
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Please check your API key.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. Please check your API key and account status.';
      } else if (data.error === 'BOZO_NZB') {
        errorMessage = 'The provided NZB file or link is invalid. Please check the file and try again.';
      } else if (data.error === 'DOWNLOAD_TOO_LARGE') {
        errorMessage = 'The download is too large for your current plan. Please upgrade your account.';
      } else if (data.error === 'MONTHLY_LIMIT') {
        errorMessage = 'You have reached your monthly download limit. Please upgrade your account.';
      } else if (data.error === 'ACTIVE_LIMIT') {
        errorMessage = 'You have reached your maximum active downloads limit. Please wait for some to complete.';
      }
      
      return Response.json(
        {
          success: false,
          error: data.error,
          detail: errorMessage,
        },
        { status: statusCode },
      );
    }

    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
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
      fetch(
        `${API_BASE}/${API_VERSION}/api/usenet/mylist?id=${id}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
      fetch(
        `${API_BASE}/${API_VERSION}/api/queued/getqueued?type=usenet`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
          },
        },
      ),
    ]);

    const [downloadsData, queuedData] = await Promise.all([
      downloadsResponse.json(),
      queuedResponse.json(),
    ]);

    // Check if the usenet item is in the queued list
    const isQueued = queuedData.data?.some(item => item.id === id);
    
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
    
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
