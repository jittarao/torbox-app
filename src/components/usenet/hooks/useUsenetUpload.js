export const useUsenetUpload = (apiKey) => {
  const uploadItem = async (nzbLink) => {
    try {
      const formData = new FormData();
      formData.append('link', nzbLink);

      const response = await fetch('/api/usenet', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey
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