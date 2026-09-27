import { NextResponse } from 'next/server';
import { sanitizeError } from '@/utils/sanitizeError';
import { toPublicUploadResponse } from '@/app/api/lib/publicUploadResponse';
import { readJsonFromResponse } from '@/utils/fetchResponse';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

export function validatePublicTorrentBatchUploads(uploads) {
  if (!Array.isArray(uploads) || uploads.length === 0) {
    return 'uploads array is required and must not be empty';
  }

  if (uploads.length > 1000) {
    return 'Maximum 1000 uploads per batch request';
  }

  if (uploads.some((upload) => upload.type !== 'torrent')) {
    return 'Only torrent uploads are supported by this endpoint';
  }

  return null;
}

export async function queuePublicTorrentBatchUploads(request, apiKey) {
  try {
    const body = await request.json();
    const { uploads } = body;
    const validationError = validatePublicTorrentBatchUploads(uploads);

    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const fileUploadPromises = uploads.flatMap((upload, index) => {
      if (upload.upload_type !== 'file') {
        return [];
      }

      if (!upload.file_data) {
        // A file upload without file_data can never be staged. Surface it as a
        // per-item staging error instead of silently dropping it so the response
        // indices and meta counts stay aligned with the request.
        return [
          Promise.resolve({
            index,
            upload,
            code: 'file_stage_failed',
            error: 'file_data is required for file uploads',
          }),
        ];
      }

      return [
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
              type: 'torrent',
            }),
          });

          if (!fileUploadResponse.ok) {
            const errorData = await fileUploadResponse.json().catch(() => ({}));
            return {
              index,
              upload,
              code: 'file_stage_failed',
              error: errorData.error || 'Failed to save file',
            };
          }

          const fileUploadData = await fileUploadResponse.json();
          return { index, upload, file_path: fileUploadData.data.file_path };
        })(),
      ];
    });

    const fileUploadResults = await Promise.all(fileUploadPromises);
    const filePathMap = new Map();
    const fileUploadErrors = [];

    fileUploadResults.forEach((result) => {
      if (result.error) {
        fileUploadErrors.push({
          index: result.index,
          name: result.upload?.name ?? null,
          code: result.code || 'file_stage_failed',
          error: result.error,
          upload: result.upload,
        });
      } else {
        filePathMap.set(result.index, result.file_path);
      }
    });

    const preparedUploads = [];
    uploads.forEach((upload, index) => {
      const isFile = upload.upload_type === 'file';
      if (isFile && !filePathMap.has(index)) {
        return;
      }

      const prepared = { ...upload, type: 'torrent', index };
      if (isFile) {
        prepared.file_path = filePathMap.get(index);
        delete prepared.file_data;
        delete prepared.filename;
      }
      preparedUploads.push(prepared);
    });

    const response = await fetch(`${BACKEND_URL}/api/uploads/batch`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ uploads: preparedUploads }),
    });

    const { ok: responseOk, status: responseStatus, data } = await readJsonFromResponse(response);

    if (!responseOk) {
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
        })
      );
      await Promise.allSettled(cleanupPromises);

      return NextResponse.json(
        {
          success: false,
          error: data.error || `Backend responded with status: ${responseStatus}`,
          detail: data.detail,
        },
        { status: responseStatus }
      );
    }

    const errors = [
      ...fileUploadErrors,
      ...((Array.isArray(data.data?.errors) && data.data.errors) || []),
    ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    const publicUploads = (data.data?.uploads || []).map(
      (upload) => toPublicUploadResponse(upload).data
    );

    return NextResponse.json({
      success: true,
      error: null,
      detail: 'Torrents Queued Successfully',
      data: {
        uploads: publicUploads,
        errors: errors.length > 0 ? errors : undefined,
      },
      meta: {
        total: uploads.length,
        successful: publicUploads.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error('Error creating public torrent batch upload:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
