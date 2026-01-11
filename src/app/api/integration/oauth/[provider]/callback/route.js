import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function GET(request, { params }) {
  const { provider } = await params;
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Map our provider IDs to the API's expected format
  // Only these providers support OAuth
  const providerMapping = {
    'google_drive': 'google',
    'dropbox': 'dropbox',
    'onedrive': 'onedrive',
  };

  const apiProvider = providerMapping[provider];
  if (!apiProvider) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?oauth_error=invalid_provider`
    );
  }

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?oauth_error=${error}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?oauth_error=no_code`
    );
  }

  try {
    const response = await fetch(
      `${API_BASE}/${API_VERSION}/api/integration/oauth/${apiProvider}/callback?code=${code}&state=${state}`,
      {
        headers: {
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?oauth_error=${errorData.error || 'callback_failed'}`
      );
    }

    const data = await response.json();
    
    if (data.success) {
      // According to the API docs, the callback should redirect to torbox.app
      // But we'll redirect back to our app with success status
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?oauth_success=${provider}`
      );
    } else {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?oauth_error=${data.error || 'callback_failed'}`
      );
    }
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}?oauth_error=callback_error`
    );
  }
}
