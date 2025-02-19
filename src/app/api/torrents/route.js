import { headers } from 'next/headers';

const API_BASE = "https://api.torbox.app";
const API_VERSION = "v1";

export async function GET() {
  const headersList = headers();
  const apiKey = headersList.get('x-api-key');

  try {
    const response = await fetch(`${API_BASE}/${API_VERSION}/api/torrents/mylist`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const headersList = headers();
  const apiKey = headersList.get('x-api-key');
  const formData = await request.formData();

  try {
    const response = await fetch(`${API_BASE}/${API_VERSION}/api/torrents/createtorrent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const headersList = headers();
  const apiKey = headersList.get('x-api-key');
  const { torrent_id } = await request.json();

  try {
    const response = await fetch(`${API_BASE}/${API_VERSION}/api/torrents/controltorrent`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        torrent_id,
        operation: 'Delete'
      })
    });
    const data = await response.json();
    return Response.json(data);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
} 