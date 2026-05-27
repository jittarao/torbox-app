'use client';

import { useEffect } from 'react';

export const FileHandler = () => {
  useEffect(() => {
    if ('launchQueue' in window && 'LaunchParams' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files.length) return;

        const fileHandles = launchParams.files;
        const files = await Promise.all(fileHandles.map((fileHandle) => fileHandle.getFile()));
        for (const file of files) {
          if (file.name.endsWith('.torrent') || file.name.endsWith('.nzb')) {
            // Handle the file - you can emit an event or call a handler function
            const reader = new FileReader();
            reader.onload = (e) => {
              const fileData = e.target?.result;
              // Dispatch custom event with file data
              window.dispatchEvent(
                new CustomEvent('fileReceived', {
                  detail: {
                    name: file.name,
                    type: file.type,
                    data: fileData,
                  },
                })
              );
            };
            reader.readAsArrayBuffer(file);
          }
        }
      });
    }

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data.type === 'FILE_RECEIVED') {
        const file = event.data.file;
        const reader = new FileReader();
        reader.onload = (e) => {
          const fileData = e.target?.result;
          window.dispatchEvent(
            new CustomEvent('fileReceived', {
              detail: {
                name: file.name,
                type: file.type,
                data: fileData,
              },
            })
          );
        };
        reader.readAsArrayBuffer(file);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleServiceWorkerMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleServiceWorkerMessage);
    };
  }, []);

  return null; // This is a utility component, no UI needed
};
