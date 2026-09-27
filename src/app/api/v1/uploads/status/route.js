import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { resolveTorboxApiKey } from '@/app/api/lib/resolveTorboxApiKey';
import { fetchPublicUploadStatus } from '@/app/api/lib/publicUploadStatus';

export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Upload logs feature is disabled when backend is disabled');
  }

  const auth = await resolveTorboxApiKey();
  if (auth.response) return auth.response;

  return fetchPublicUploadStatus(request, auth.apiKey);
}
