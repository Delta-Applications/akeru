const SYSTEM_MESSAGE_TYPES = [
  'cdma-info-rec-received',
  'ussd-received',
  'bluetooth-dialer-command'
];
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.onsystemmessage = (evt) => {
  if (SYSTEM_MESSAGE_TYPES.includes(evt.name)) {
    evt.waitUntil(
      clients.matchAll({ //eslint-disable-line
        includeUncontrolled: true,
        type: 'window'
      }).then((clientList) => {
        clientList.forEach((client) => {
          client.postMessage({
            type: evt.name,
            data: evt.data.json()
          });
        });
      })
    );
  }
};
