import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { queueTorrentUpload } from '@/app/api/lib/queueTorrentUpload';
import { resolveTorboxApiKey } from '@/app/api/lib/resolveTorboxApiKey';
import { toPublicUploadError, toPublicUploadResponse } from '@/app/api/lib/publicUploadResponse';

export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Upload logs feature is disabled when backend is disabled');
  }

  const auth = await resolveTorboxApiKey();
  if (auth.response) return auth.response;

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return toPublicUploadError('multipart/form-data body is required', 400);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  const magnet = formData.get('magnet');
  const hasFile = file instanceof File;
  const hasMagnet = typeof magnet === 'string' && magnet.trim().length > 0;

  if ((hasFile && hasMagnet) || (!hasFile && !hasMagnet)) {
    return toPublicUploadError('Exactly one of file or magnet is required', 400);
  }

  if (formData.has('link')) {
    return toPublicUploadError('link is not supported on this endpoint', 400);
  }

  const { upload, response } = await queueTorrentUpload(formData, auth.apiKey, {
    allowLink: false,
  });
  if (response) return response;

  return Response.json(toPublicUploadResponse(upload));
}
