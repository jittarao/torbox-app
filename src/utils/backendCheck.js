import { NextResponse } from 'next/server';

/**
 * Check if backend is disabled via BACKEND_DISABLED environment variable
 * @returns {boolean} True if backend is disabled
 */
export function isBackendDisabled() {
  return process.env.BACKEND_DISABLED === 'true';
}

/**
 * Get a standardized response for when backend features are disabled
 * @param {string} message - Custom error message
 * @returns {NextResponse} 503 Service Unavailable response
 */
export function getBackendDisabledResponse(message = 'Backend features are disabled') {
  return NextResponse.json({ success: false, error: message }, { status: 503 });
}
