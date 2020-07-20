self.addEventListener('install', function(event) {
    console.info('SW Install', event);
  });

self.addEventListener('activate', function(event) {
    console.info('SW Activate', event);
});

self.addEventListener('fetch', (event) => {
    console.info('SW Fetch', event);
});