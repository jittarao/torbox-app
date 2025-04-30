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
    console.log(`Query: ${query}`);
    if (query.startsWith('imdb:')) {
      const imdbId = query.substring(5); // Remove 'imdb:' prefix
      console.log(`Fetching IMDB ID: ${imdbId}`);
      endpoint = `${API_SEARCH_BASE}/torrents/imdb:${imdbId}?${params}`;
    } else {
      endpoint = `${API_SEARCH_BASE}/torrents/search/${encodeURIComponent(query)}?${params}`;
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
    console.error('Torrent search error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }
}
