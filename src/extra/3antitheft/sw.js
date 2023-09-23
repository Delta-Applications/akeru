'use strict';

self.addEventListener('install', (evt) => {
  evt.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.onsystemmessage = (evt) => {
  const handler = evt.data.webActivityRequestHandler();
  if ('activity' === evt.name) {
    clients.openWindow('/index.html', { disposition: 'attention' }).then(
      client => {
        console.log('openWindow success!', client);
        client.postMessage({
          source: handler && handler.source
        });
      },
      err => {
        console.log(`openWindow fail with error: ${err}`);
      }
    );
  }
};
