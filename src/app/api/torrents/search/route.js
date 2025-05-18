import { headers } from 'next/headers';
import {
  API_SEARCH_BASE,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

const SEARCH_PREFIXES = ['imdb', 'tvdb', 'jikan'];

export async function GET(req) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const { searchParams } = new URL(req.url);
  const query = decodeURIComponent(searchParams.get('query'));
  const searchUserEngines = searchParams.get('search_user_engines') === 'true';
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

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
      ...( season && { season } ),
      ...( episode && { episode } ),
    });

    let endpoint;
    console.log(`Query: ${query}`);
    let searchEngine = SEARCH_PREFIXES.find((prefix) => query.startsWith(prefix + ":"));
    if (searchEngine) {
      const systemId = query.substring(searchEngine.length + 1);
      console.log(`Fetching ${searchEngine} ID: ${systemId}`);
      endpoint = `${API_SEARCH_BASE}/torrents/${searchEngine}:${systemId}?${params}`;
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
