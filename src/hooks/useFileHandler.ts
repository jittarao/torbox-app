import { useEffect } from 'react';

interface FileReceivedEvent {
  detail: {
    name: string;
    type: string;
    data: ArrayBuffer;
  };
}

export const useFileHandler = (
  onFileReceived: (file: FileReceivedEvent['detail']) => void,
) => {
  useEffect(() => {
    const handleFileReceived = (
      event: CustomEvent<FileReceivedEvent['detail']>,
    ) => {
      onFileReceived(event.detail);
    };

    window.addEventListener(
      'fileReceived',
      handleFileReceived as EventListener,
    );
    return () => {
      window.removeEventListener(
        'fileReceived',
        handleFileReceived as EventListener,
      );
    };
  }, [onFileReceived]);
};
