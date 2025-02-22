export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query');
  const page = searchParams.get('page') || 1;
  const apiKey = req.headers.get('x-api-key'); // Get the API key from the request headers

  if (!query) {
    return new Response(JSON.stringify({ error: 'Query parameter is required' }), { status: 400 });
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key is required' }), { status: 401 });
  }

  try {
    const res = await fetch(
      `https://search-api.torbox.app/torrents/search/${encodeURIComponent(query)}?` +
      new URLSearchParams({
        metadata: true,
        check_cache: true,
        page: page
      }), {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );

    if (!res.ok) {
      throw new Error(`Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (error) {
    console.error('Server-side search error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
} 