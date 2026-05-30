export function sanitizeError(error) {
  const message = error?.message || String(error || '');
  if (process.env.NODE_ENV === 'production') {
    return 'Internal server error';
  }
  return message;
}
