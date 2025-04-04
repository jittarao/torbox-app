import { useUpload } from '../components/shared/hooks/useUpload';

const ARCHIVE_KEY = 'torboxArchivedDownloads';

export function useArchive(apiKey) {
  const { uploadItem } = useUpload(apiKey);

  const getArchivedDownloads = () => {
    const archived = localStorage.getItem(ARCHIVE_KEY);
    return archived ? JSON.parse(archived) : [];
  };

  const archiveDownload = (download) => {
    const archived = getArchivedDownloads();
    const updatedArchive = [
      ...archived.filter((item) => item.id !== download.id),
      { ...download, archivedAt: Date.now() },
    ];
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updatedArchive));
    return updatedArchive;
  };

  const removeFromArchive = (downloadId) => {
    const archived = getArchivedDownloads();
    const updatedArchive = archived.filter((item) => item.id !== downloadId);
    localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updatedArchive));
    return updatedArchive;
  };

  const clearArchive = () => {
    localStorage.removeItem(ARCHIVE_KEY);
    return [];
  };

  const restoreFromArchive = async (download) => {
    const encodedName = encodeURIComponent(download.name || 'Unknown');
    const magnetLink = `magnet:?xt=urn:btih:${download.hash}&dn=${encodedName}`;

    try {
      const result = await uploadItem({
        type: 'magnet',
        data: magnetLink,
        name: download.name,
        seed: 3,
        allowZip: true,
        asQueued: false,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // const updatedArchive = archived.filter((item) => item.id !== download.id);
      // localStorage.setItem(ARCHIVE_KEY, JSON.stringify(updatedArchive));
    } catch (error) {
      console.error('Failed to restore from archive:', error);
    }
  };

  return {
    getArchivedDownloads,
    archiveDownload,
    removeFromArchive,
    clearArchive,
    restoreFromArchive,
  };
}
