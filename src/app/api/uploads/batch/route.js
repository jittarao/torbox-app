import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isBackendDisabled, getBackendDisabledResponse } from '@/utils/backendCheck';
import { sanitizeError } from '@/utils/sanitizeError';
import {
  extractRateLimitHeaders,
  jsonWithRateLimitHeaders,
  mergeRateLimitHeaders,
} from '@/app/api/lib/forwardRateLimitHeaders';
import { readJsonFromResponse } from '@/utils/fetchResponse';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

function rateLimitedUploadResponse(rateLimitHeaders, error, detail) {
  return jsonWithRateLimitHeaders(
    {
      success: false,
      error,
      detail,
    },
    {
      status: 429,
      headers: rateLimitHeaders,
    }
  );
}

// POST /api/uploads/batch - Batch create uploads (efficient for large batches)
export async function POST(request) {
  if (isBackendDisabled()) {
    return getBackendDisabledResponse('Upload logs feature is disabled when backend is disabled');
  }

  try {
    const headersList = await headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key is required' }, { status: 400 });
    }

    const body = await request.json();
    const { uploads } = body;

    if (!Array.isArray(uploads) || uploads.length === 0) {
      return NextResponse.json(
        { success: false, error: 'uploads array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (uploads.length > 1000) {
      return NextResponse.json(
        { success: false, error: 'Maximum 1000 uploads per batch request' },
        { status: 400 }
      );
    }

    // First, upload all files in parallel (if any)
    const fileUploadPromises = uploads.reduce((acc, upload) => {
      if (upload.upload_type === 'file' && upload.file_data) {
        acc.push(
          (async () => {
            const fileUploadResponse = await fetch(`${BACKEND_URL}/api/uploads/file`, {
              method: 'POST',
              cache: 'no-store',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
              },
              body: JSON.stringify({
                file_data: upload.file_data,
                filename: upload.filename,
                type: upload.type,
              }),
            });

            if (fileUploadResponse.status === 429) {
              const errorData = await fileUploadResponse.json().catch(() => ({}));
              return {
                upload,
                rateLimited: true,
                rateLimitHeaders: extractRateLimitHeaders(fileUploadResponse),
                error: errorData.error || 'Too many upload requests, please try again later.',
                detail:
                  errorData.detail ||
                  'Upload rate limit exceeded. Please wait before making more requests.',
              };
            }

            if (!fileUploadResponse.ok) {
              const errorData = await fileUploadResponse.json().catch(() => ({}));
              return { upload, error: errorData.error || 'Failed to save file' };
            }

            const fileUploadData = await fileUploadResponse.json();
            return { upload, file_path: fileUploadData.data.file_path };
          })()
        );
      }
      return acc;
    }, []);

    const fileUploadResults = await Promise.all(fileUploadPromises);

    const rateLimitedFileResults = fileUploadResults.filter((result) => result.rateLimited);
    if (rateLimitedFileResults.length > 0) {
      const rateLimitHeaders = mergeRateLimitHeaders(
        ...rateLimitedFileResults.map((result) => result.rateLimitHeaders)
      );
      const first = rateLimitedFileResults[0];
      return rateLimitedUploadResponse(rateLimitHeaders, first.error, first.detail);
    }

    // Map file paths back to uploads
    const filePathMap = new Map();
    const fileUploadErrors = [];
    fileUploadResults.forEach((result) => {
      if (result.error) {
        fileUploadErrors.push(result);
      } else {
        filePathMap.set(result.upload, result.file_path);
      }
    });

    // Prepare uploads for batch endpoint (remove file_data, add file_path)
    // Filter out uploads that failed file upload - they're already in fileUploadErrors
    const preparedUploads = uploads.reduce((acc, upload) => {
      if (upload.upload_type !== 'file' || filePathMap.has(upload)) {
        const prepared = { ...upload };
        if (upload.upload_type === 'file') {
          prepared.file_path = filePathMap.get(upload);
          delete prepared.file_data;
          delete prepared.filename;
        }
        acc.push(prepared);
      }
      return acc;
    }, []);

    // Create batch upload entries
    const response = await fetch(`${BACKEND_URL}/api/uploads/batch`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ uploads: preparedUploads }),
    });

    const rateLimitHeaders = extractRateLimitHeaders(response);

    if (response.status === 429) {
      const rateLimitData = await response.json().catch(() => ({}));
      return rateLimitedUploadResponse(
        rateLimitHeaders,
        rateLimitData.error || 'Too many upload requests, please try again later.',
        rateLimitData.detail ||
          'Upload rate limit exceeded. Please wait before making more requests.'
      );
    }

    const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

    if (!responseOk) {
      // Clean up all successfully uploaded files if batch creation failed
      const cleanupPromises = Array.from(filePathMap.values()).map((filePath) =>
        fetch(`${BACKEND_URL}/api/uploads/file`, {
          method: 'DELETE',
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify({ file_path: filePath }),
        }).catch((cleanupError) => {
          console.error(
            `Error cleaning up file ${filePath} after batch creation failure:`,
            cleanupError
          );
          // Continue even if individual cleanup fails
        })
      );

      // Wait for all cleanup operations to complete (but don't fail if they do)
      await Promise.allSettled(cleanupPromises);

      return jsonWithRateLimitHeaders(
        {
          success: false,
          error: data.error || `Backend responded with status: ${responseStatus}`,
          detail: data.detail,
        },
        {
          status: responseStatus,
          headers: rateLimitHeaders,
        }
      );
    }

    // Merge file upload errors with batch errors
    if (fileUploadErrors.length > 0 && data.data?.errors) {
      data.data.errors = [...fileUploadErrors, ...data.data.errors];
    } else if (fileUploadErrors.length > 0) {
      data.data = data.data || {};
      data.data.errors = fileUploadErrors;
    }

    return jsonWithRateLimitHeaders(data, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('Error creating batch upload:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
