import { safeJsonParse } from '@/utils/safeJsonParse';
import { sanitizeError } from '@/utils/sanitizeError';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

function formFlag(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

async function cleanupStagedFile(apiKey, filePath) {
  if (!filePath) return;
  try {
    await fetch(`${BACKEND_URL}/api/uploads/file`, {
      cache: 'no-store',
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ file_path: filePath }),
    });
  } catch (cleanupError) {
    console.error('Error cleaning up file after queue entry creation failure:', cleanupError);
  }
}

export async function queueTorrentUpload(requestOrFormData, apiKey, options = {}) {
  const { allowLink = true } = options;
  const formData =
    typeof requestOrFormData.formData === 'function'
      ? await requestOrFormData.formData()
      : requestOrFormData;

  let filePath = null;

  try {
    const file = formData.get('file');
    const magnet = formData.get('magnet');
    const link = allowLink ? formData.get('link') : null;
    const seed = formData.get('seed');
    const allowZip = formData.get('allow_zip');
    const asQueued = formData.get('as_queued');
    const addOnlyIfCached = formData.get('add_only_if_cached');
    const name = formData.get('name');

    let upload_type;
    let url = null;

    if (magnet) {
      upload_type = 'magnet';
      url = magnet;
    } else if (link) {
      upload_type = 'link';
      url = link;
    } else if (file) {
      upload_type = 'file';
      const arrayBuffer = await file.arrayBuffer();
      const fileData = Buffer.from(arrayBuffer).toString('base64');

      const fileUploadResponse = await fetch(`${BACKEND_URL}/api/uploads/file`, {
        cache: 'no-store',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          file_data: fileData,
          filename: file.name,
          type: 'torrent',
        }),
      });

      if (!fileUploadResponse.ok) {
        const errorData = await fileUploadResponse.json().catch(() => ({}));
        return {
          upload: null,
          response: Response.json(
            {
              success: false,
              error: errorData.error || 'Failed to save file',
            },
            { status: fileUploadResponse.status }
          ),
        };
      }

      const fileUploadData = await fileUploadResponse.json();
      filePath = fileUploadData.data.file_path;
    } else {
      return {
        upload: null,
        response: Response.json(
          {
            success: false,
            error: allowLink ? 'file, magnet, or link is required' : 'file or magnet is required',
          },
          { status: 400 }
        ),
      };
    }

    const requestBody = {
      type: 'torrent',
      upload_type,
      file_path: filePath,
      url,
      name: name || (file ? file.name : 'Unknown'),
      seed: seed ? parseInt(seed, 10) : null,
    };

    // Omit when unset so the backend default (allow_zip=true) applies.
    if (allowZip != null && allowZip !== '') {
      requestBody.allow_zip = formFlag(allowZip);
    }
    if (formFlag(addOnlyIfCached)) {
      requestBody.add_only_if_cached = true;
    }
    if (formFlag(asQueued)) {
      requestBody.as_queued = true;
    }

    const uploadResponse = await fetch(`${BACKEND_URL}/api/uploads`, {
      cache: 'no-store',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const uploadData = await safeJsonParse(uploadResponse);

    if (!uploadResponse.ok) {
      await cleanupStagedFile(apiKey, filePath);
      return {
        upload: null,
        response: Response.json(
          {
            success: false,
            error: uploadData.error || `Backend responded with status: ${uploadResponse.status}`,
            detail: uploadData.detail,
          },
          { status: uploadResponse.status }
        ),
      };
    }

    return { upload: uploadData.data, response: null };
  } catch (error) {
    await cleanupStagedFile(apiKey, filePath);
    return {
      upload: null,
      response: Response.json({ success: false, error: sanitizeError(error) }, { status: 500 }),
    };
  }
}
