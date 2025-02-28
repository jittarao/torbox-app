import { useEffect } from 'react';

export const useFileHandler = (onFileReceived) => {
  useEffect(() => {
    const handleFileReceived = (event) => {
      onFileReceived(event.detail);
    };

    window.addEventListener('fileReceived', handleFileReceived);
    return () => {
      window.removeEventListener('fileReceived', handleFileReceived);
    };
  }, [onFileReceived]);
};
