import { NextResponse } from 'next/server';
import { API_BASE, API_VERSION, TORBOX_MANAGER_VERSION } from '@/components/constants';
import { torboxFetch } from '@/app/api/lib/torboxFetch';
import { requireTorboxApiKey } from '@/app/api/lib/requireTorboxApiKey';
import { sanitizeError } from '@/utils/sanitizeError';
import { guardDestructiveOrRespond } from '@/app/api/lib/downloadProtectionGuard';
export async function POST(request) {
  const auth = await requireTorboxApiKey();
  if (auth.response) return auth.response;
  const apiKey = auth.apiKey;

  try {
    const { torrent_id, operation } = await request.json();

    if (operation === 'stop_seeding') {
      const blocked = await guardDestructiveOrRespond(apiKey, [torrent_id], 'stop_seeding');
      if (blocked) return blocked;
    }

    const response = await torboxFetch(`${API_BASE}/${API_VERSION}/api/torrents/controltorrent`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
      },
      body: JSON.stringify({ torrent_id, operation }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data.message },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
