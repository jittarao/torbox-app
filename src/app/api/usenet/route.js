import { headers } from 'next/headers';
import { API_BASE, API_VERSION } from '@/components/constants';

export async function POST(request) {
  const headersList = await headers();
  const apiKey = headersList.get('x-api-key');
  const formData = await request.formData();

  try {
    const response = await fetch(`${API_BASE}/${API_VERSION}/api/usenet/createusenetdownload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    const data = await response.json();
    
    if (!response.ok || !data.success) {
      return Response.json({
        success: false,
        error: data.error,
        detail: data.detail || 'Failed to add NZB'
      }, { status: response.status || 400 });
    }
    
    return Response.json(data);
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
} 