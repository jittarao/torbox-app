import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  API_BASE,
  API_VERSION,
  TORBOX_MANAGER_VERSION,
} from '@/components/constants';

export async function GET() {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: 'API key is required' },
      { status: 401 },
    );
  }

  try {
    // Try to get integration jobs to check if the feature is available
    const jobsResponse = await fetch(
      `${API_BASE}/${API_VERSION}/api/integration/jobs`,
      {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      },
    );

    if (!jobsResponse.ok) {
      // If integration jobs endpoint is not available, return empty status
      return NextResponse.json({
        success: true,
        data: {
          providers: {},
          feature_available: false,
        },
      });
    }

    const jobsData = await jobsResponse.json();
    
    // Check for configured providers by looking at user settings or trying to get provider-specific info
    const providers = {
      google_drive: false,
      dropbox: false,
      onedrive: false,
      gofile: false,
      '1fichier': false,
      pixeldrain: false,
    };

    // Try to check each provider by attempting to get their status
    // This is a workaround since TorBox might not have a direct endpoint for this
    const providerChecks = await Promise.allSettled([
      // Try to get Google Drive status
      fetch(`${API_BASE}/${API_VERSION}/api/integration/googledrive`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }).then(res => res.ok),
      
      // Try to get Dropbox status
      fetch(`${API_BASE}/${API_VERSION}/api/integration/dropbox`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }).then(res => res.ok),
      
      // Try to get OneDrive status
      fetch(`${API_BASE}/${API_VERSION}/api/integration/onedrive`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }).then(res => res.ok),
      
      // Try to get GoFile status
      fetch(`${API_BASE}/${API_VERSION}/api/integration/gofile`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }).then(res => res.ok),
      
      // Try to get 1Fichier status
      fetch(`${API_BASE}/${API_VERSION}/api/integration/1fichier`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }).then(res => res.ok),
      
      // Try to get Pixeldrain status
      fetch(`${API_BASE}/${API_VERSION}/api/integration/pixeldrain`, {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': `TorBoxManager/${TORBOX_MANAGER_VERSION}`,
        },
      }).then(res => res.ok),
    ]);

    // Update provider status based on responses
    if (providerChecks[0].status === 'fulfilled') {
      providers.google_drive = providerChecks[0].value;
    }
    if (providerChecks[1].status === 'fulfilled') {
      providers.dropbox = providerChecks[1].value;
    }
    if (providerChecks[2].status === 'fulfilled') {
      providers.onedrive = providerChecks[2].value;
    }
    if (providerChecks[3].status === 'fulfilled') {
      providers.gofile = providerChecks[3].value;
    }
    if (providerChecks[4].status === 'fulfilled') {
      providers['1fichier'] = providerChecks[4].value;
    }
    if (providerChecks[5].status === 'fulfilled') {
      providers.pixeldrain = providerChecks[5].value;
    }

    return NextResponse.json({
      success: true,
      data: {
        providers,
        feature_available: true,
        active_jobs: jobsData.data || [],
      },
    });
  } catch (error) {
    console.error('Error checking cloud provider status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        data: {
          providers: {},
          feature_available: false,
        }
      },
      { status: 500 },
    );
  }
}
