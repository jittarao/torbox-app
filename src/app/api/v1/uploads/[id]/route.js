import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { sanitizeError } from '@/utils/sanitizeError';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import { resolveTorboxApiKey } from '@/app/api/lib/resolveTorboxApiKey';
import { toPublicUploadResponse } from '@/app/api/lib/publicUploadResponse';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export async function GET(_request, { params }) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Upload logs feature is disabled when backend is disabled');
  }

  const auth = await resolveTorboxApiKey();
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const response = await fetch(`${BACKEND_URL}/api/uploads/${id}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'x-api-key': auth.apiKey,
      },
    });

    const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

    if (!responseOk) {
      return Response.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${responseStatus}`,
          detail: data.detail,
        },
        { status: responseStatus }
      );
    }

    return Response.json(toPublicUploadResponse(data.data));
  } catch (error) {
    return Response.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
