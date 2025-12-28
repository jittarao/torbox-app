import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';
import { NextResponse } from 'next/server';

// Get all RSS feeds
export async function GET() {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ 
        success: false,
        error: 'API key is required' 
      }, { status: 400 });
    }

    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/rss/getfeeds`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('RSS API error:', errorData);
      return NextResponse.json({ 
        success: false,
        error: errorData.error || errorData.detail || `API responded with status: ${response.status}` 
      }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({
      success: true,
      data: data.data || data || []
    });
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

// Add a new RSS feed
export async function POST(request) {
  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ 
        success: false,
        error: 'API key is required' 
      }, { status: 400 });
    }

    const body = await request.json();
    const { action, ...feedData } = body;

    let endpoint;
    if (action === 'add') {
      endpoint = `${API_BASE}/${API_VERSION}/api/rss/addrss`;
    } else if (action === 'modify') {
      endpoint = `${API_BASE}/${API_VERSION}/api/rss/modifyrss`;
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid action. Use "add" or "modify"' 
        },
        { status: 400 },
      );
    }

    // Process data based on endpoint
    const processedFeedData = { ...feedData };
    
    if (action === 'add') {
      // For add endpoint: try both array and single value formats
      if (Array.isArray(processedFeedData.scan_interval)) {
        processedFeedData.scan_interval = processedFeedData.scan_interval[0];
      }
      if (Array.isArray(processedFeedData.rss_type)) {
        processedFeedData.rss_type = processedFeedData.rss_type[0];
      }
    } else if (action === 'modify') {
      // For modify endpoint: ensure scan_interval is integer, rss_type is string
      if (Array.isArray(processedFeedData.scan_interval)) {
        processedFeedData.scan_interval = processedFeedData.scan_interval[0];
      }
      if (Array.isArray(processedFeedData.rss_type)) {
        processedFeedData.rss_type = processedFeedData.rss_type[0];
      }
    }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      body: JSON.stringify(processedFeedData),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('RSS API error:', data);
      
      // Handle validation error format
      let errorMessage = 'Failed to process RSS feed';
      if (data.detail && Array.isArray(data.detail)) {
        errorMessage = data.detail.map(err => {
          const fieldPath = err.loc?.join('.') || 'unknown';
          const fieldValue = JSON.stringify(err.input);
          return `${fieldPath}: ${err.msg} (got: ${fieldValue})`;
        }).join(', ');
      } else if (data.error) {
        errorMessage = data.error;
      }
      
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
        },
        { status: response.status },
      );
    }

    return NextResponse.json({
      success: true,
      data: data.data || data
    });
  } catch (error) {
    console.error('Error processing RSS feed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 },
    );
  }
}
