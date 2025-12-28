import { headers } from 'next/headers';
import {
  API_SEARCH_BASE,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function GET(req) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(req.url);
  const query = decodeURIComponent(searchParams.get('query'));
  const searchUserEngines = searchParams.get('search_user_engines') === 'true';

  if (!query) {
    return new Response(
      JSON.stringify({ error: 'Query parameter is required' }),
      { status: 400 },
    );
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key is required' }), {
      status: 401,
    });
  }

  try {
    const params = new URLSearchParams({
      metadata: true,
      check_cache: true,
      search_user_engines: searchUserEngines,
    });

    let endpoint;
    if (query.startsWith('imdb:')) {
      const imdbId = query.substring(5);
      endpoint = `${API_SEARCH_BASE}/usenet/imdb:${imdbId}?${params}`;
    } else {
      endpoint = `${API_SEARCH_BASE}/usenet/search/${encodeURIComponent(query)}?${params}`;
    }

    const res = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
    });

    if (!res.ok) {
      throw new Error(`Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error('Usenet search error:', error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to search usenet';
    let statusCode = 500;
    
    if (error.message.includes('502')) {
      errorMessage = 'TorBox search servers are temporarily unavailable. Please try again in a few minutes.';
      statusCode = 502;
    } else if (error.message.includes('503')) {
      errorMessage = 'TorBox search servers are temporarily overloaded. Please try again in a few minutes.';
      statusCode = 503;
    } else if (error.message.includes('504')) {
      errorMessage = 'TorBox search servers are taking too long to respond. Please try again in a few minutes.';
      statusCode = 504;
    } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      errorMessage = 'Unable to connect to TorBox search servers. Please check your internet connection and try again.';
      statusCode = 503;
    } else if (error.message.includes('401')) {
      errorMessage = 'Authentication failed. Please check your API key.';
      statusCode = 401;
    } else if (error.message.includes('403')) {
      errorMessage = 'Access denied. Please check your API key and account status.';
      statusCode = 403;
    } else if (error.message.includes('429')) {
      errorMessage = 'Too many search requests. Please wait a moment and try again.';
      statusCode = 429;
    }
    
    return new Response(JSON.stringify({ 
      error: errorMessage,
      originalError: error.message 
    }), { status: statusCode });
  }
}
