export const useUsenetUpload = (apiKey) => {
  const uploadItem = async (nzbLink) => {
    try {
      const formData = new FormData();
      formData.append('link', nzbLink);

      const response = await fetch('https://api.torbox.app/v1/api/usenet/createusenetdownload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to add NZB');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return { uploadItem };
}; 