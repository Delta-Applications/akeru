'use strict';

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    clients.claim().then(function() {
      // After the activation and claiming is complete, send a message to each of the controlled
      // pages letting it know that it's active.
      // This will trigger navigator.serviceWorker.onmessage in each client.
      return self.clients.matchAll().then(function(clients) {
        return Promise.all(clients.map(function(client) {
          return client.postMessage('The service worker has activated and ' +
            'taken control.');
        }));
      });
    })
  );
});

self.addEventListener('push', function(event) {
  console.log('Received a push message', event);

  event.waitUntil(clients.matchAll({
    type: 'window'
  }).then(function(clientList) {
    console.log('clientList ' + clientList.length);
    for (var i = 0; i < clientList.length; i++) {
      var client = clientList[i];
      console.log('New push sending');
      var obj = {};
      obj.reason = 'executecommand';
      obj.command = event.data.text();
      client.postMessage(obj);
    }
  }));
});

self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('Subscription expired');
  event.waitUntil(
    clients.matchAll().then(function(clients) {
      return Promise.all(clients.map(function(client) {
        console.log('pushsubscriptionchange sending');
        var obj = {};
        obj.reason = 'pushsubscriptionchange';
        obj.command = null;
        return client.postMessage(obj);
      }));
    })
  );
});