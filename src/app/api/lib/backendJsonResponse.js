import { NextResponse } from 'next/server';

/**
 * Forward a backend JSON body to the browser with the backend's status code.
 * Non-2xx bodies pass through so clients see the backend's error message; an
 * empty error body becomes a generic error instead of `{}`.
 */
export async function backendJsonResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const hasBody = data && typeof data === 'object' && Object.keys(data).length > 0;
    return NextResponse.json(
      hasBody ? data : { success: false, error: `Backend request failed (${response.status})` },
      { status: response.status }
    );
  }

  return NextResponse.json(data, { status: response.status });
}
