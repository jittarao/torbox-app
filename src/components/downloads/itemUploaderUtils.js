import { getJSON, setJSON } from '@/utils/storage';

export const UPLOADER_EXPANDED_KEY = 'uploader-expanded';
export const UPLOADER_OPTIONS_KEY = 'uploader-options-expanded';
export const NZB_TIPS_HIDDEN_KEY = 'nzb-tips-hidden';

const DEFAULT_EXPANDED_STATES = {
  torrents: false,
  usenet: false,
  webdl: false,
};

export function getExpandedStates() {
  const parsed = getJSON(UPLOADER_EXPANDED_KEY);
  if (parsed) {
    return { ...DEFAULT_EXPANDED_STATES, ...parsed };
  }
  return DEFAULT_EXPANDED_STATES;
}

export function saveExpandedStates(states) {
  setJSON(UPLOADER_EXPANDED_KEY, states);
}

export function getAssetTypeInfo(activeType, t, commonT) {
  switch (activeType) {
    case 'usenet':
      return {
        title: t('title.usenet'),
        mobileTitle: commonT('itemTypes.Usenet'),
        inputPlaceholder: t('placeholder.usenet'),
        dropzoneText: t('dropzone.usenet'),
        buttonText: t('button.usenet'),
        fileExtension: '.nzb',
        showDropzone: true,
      };
    case 'webdl':
      return {
        title: t('title.webdl'),
        mobileTitle: commonT('itemTypes.Web'),
        inputPlaceholder: t('placeholder.webdl'),
        dropzoneText: '',
        buttonText: t('button.webdl'),
        fileExtension: '',
        showDropzone: false,
      };
    default:
      return {
        title: t('title.torrents'),
        mobileTitle: commonT('itemTypes.Torrents'),
        inputPlaceholder: t('placeholder.torrents'),
        dropzoneText: t('dropzone.torrents'),
        buttonText: t('button.torrents'),
        fileExtension: '.torrent',
        showDropzone: true,
      };
  }
}
