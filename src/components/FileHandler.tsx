'use client';

import { useEffect } from 'react';

export const FileHandler = () => {
  useEffect(() => {
    if ('launchQueue' in window && 'LaunchParams' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files.length) return;

        const fileHandles = launchParams.files;
        for (const fileHandle of fileHandles) {
          const file = await fileHandle.getFile();
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
                }),
              );
            };
            reader.readAsArrayBuffer(file);
          }
        }
      });
    }

    // Listen for messages from service worker
    navigator.serviceWorker?.addEventListener('message', (event) => {
      if (event.data.type === 'FILE_RECEIVED') {
        const file = event.data.file;
        // Handle the file similarly to above
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
            }),
          );
        };
        reader.readAsArrayBuffer(file);
      }
    });
  }, []);

  return null; // This is a utility component, no UI needed
};
