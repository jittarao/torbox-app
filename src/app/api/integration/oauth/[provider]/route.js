import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function GET(request, { params }) {
  const { provider } = params;
  const { searchParams } = new URL(request.url);
  const headersList = await headers();
  const apiKey = searchParams.get('apiKey') || headersList.get('x-api-key');

  // API key is not required for OAuth according to the API docs
  // but we'll keep it for tracking purposes

  // Map our provider IDs to the API's expected format
  // Only these providers support OAuth
  const providerMapping = {
    'google_drive': 'google',
    'dropbox': 'dropbox',
    'onedrive': 'onedrive',
  };

  const apiProvider = providerMapping[provider];
  if (!apiProvider) {
    return NextResponse.json(
      { success: false, error: 'Invalid provider' },
      { status: 400 },
    );
  }

  try {
    // Redirect directly to the TorBox OAuth URL
    const oauthUrl = `${API_BASE}/${API_VERSION}/api/integration/oauth/${apiProvider}`;
    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    console.error('Error starting OAuth flow:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
