const CACHE_NAME = 'torbox-cache-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/manifest.json',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png',
      ]);
    }),
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    }),
  );
});

// Handle file open events
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FILE_OPEN') {
    const file = event.data.file;
    // Handle the file based on its type
    if (file.name.endsWith('.torrent') || file.name.endsWith('.nzb')) {
      // Send the file data to the main app
      clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'FILE_RECEIVED',
            file: file,
          });
        });
      });
    }
  }
});
