const CONNECTION_ERROR_CODES = [
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ECONNABORTED',
];
const CONNECTION_ERROR_MESSAGES = ['Network Error', 'timeout'];

/**
 * @param {Error|undefined|null} error
 * @returns {boolean}
 */
export function isConnectionError(error) {
  if (!error) return false;
  if (error.isConnectionError === true) return true;

  if (!error.response) {
    return (
      CONNECTION_ERROR_CODES.includes(error.code) ||
      CONNECTION_ERROR_MESSAGES.some((msg) => error.message?.includes(msg))
    );
  }

  return error.response.status >= 500;
}
