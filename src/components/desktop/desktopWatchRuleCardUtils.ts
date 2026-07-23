import type { PostUploadAction } from '@/desktop/capabilities';

export function getFolderLabel(path: string | null, emptyLabel: string): string {
  if (!path) {
    return emptyLabel;
  }
  const normalized = path.replace(/[\\/]+$/, '');
  const segments = normalized.split(/[\\/]/);
  return segments[segments.length - 1] || path;
}

export function getPostUploadActionLabel(
  action: PostUploadAction,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  switch (action) {
    case 'delete':
      return t('actionDeleteShort');
    case 'moveToUploaded':
      return t('actionMoveToUploadedShort');
    case 'moveToCustom':
      return t('actionMoveToCustomShort');
    default:
      return action;
  }
}
