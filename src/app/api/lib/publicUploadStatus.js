import { NextResponse } from 'next/server';
import { sanitizeError } from '@/utils/sanitizeError';
import { toPublicUploadResponse } from '@/app/api/lib/publicUploadResponse';
import { readJsonFromResponse } from '@/utils/fetchResponse';
import {
  extractRateLimitHeaders,
  jsonWithRateLimitHeaders,
} from '@/app/api/lib/forwardRateLimitHeaders';

const BACKEND_URL = process.env.BACKEND_URL || 'http://torbox-backend:3001';

/**
 * Proxy a bulk upload-status read to the backend and map the response into the
 * public v1 envelope. Read-only: the backend reads the per-user SQLite `uploads`
 * table only and never calls TorBox.
 *
 * @param {Request} request
 * @param {string} apiKey
 */
export async function fetchPublicUploadStatus(request, apiKey) {
  try {
    const body = await request.json().catch(() => null);
    const ids = body?.ids;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ids array is required and must not be empty' },
        { status: 400 }
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/uploads/status`, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ ids }),
    });

    const rateLimitHeaders = extractRateLimitHeaders(response);
    const { ok, status, data } = await readJsonFromResponse(response);

    if (!ok) {
      return jsonWithRateLimitHeaders(
        {
          success: false,
          error: data.error || `Backend responded with status: ${status}`,
          detail: data.detail,
        },
        { status, headers: rateLimitHeaders }
      );
    }

    const backendData = data.data || {};
    const uploads = (Array.isArray(backendData.uploads) ? backendData.uploads : []).map(
      (upload) => toPublicUploadResponse(upload).data
    );

    return jsonWithRateLimitHeaders(
      {
        success: true,
        error: null,
        detail: 'Upload Statuses Fetched',
        data: {
          uploads,
          not_found: Array.isArray(backendData.not_found) ? backendData.not_found : [],
        },
        meta: data.meta,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    console.error('Error fetching public upload status:', error);
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
