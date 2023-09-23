/* global clients, importScripts, WebActivity, l10n*/


importScripts('http://shared.localhost/js/utils/l10n/l10n_sw.js');

const SYSTEM_MESSAGE_TYPES = [
  'activity',
  'bluetooth-pairing-aborted',
  'bluetooth-pairing-request'
];

const handlerMap = {};
let resolveIdleTimeExtension = null;

const addWebActivityRequestHandler = async (handler) => {
  // ActivityHandlerId should be unique
  const activityHandlerId = `${+new Date()}`;
  handlerMap[activityHandlerId] = await handler;
  console.log('addWebActivityRequestHandler: ', handlerMap);
  return activityHandlerId;
};

const removeWebActivityRequestHandler = async (activityHandlerId) => {
  delete await handlerMap[activityHandlerId];
  console.log('removeWebActivityRequestHandler: ', handlerMap);
};

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.onsystemmessage = (evt) => {
  if (SYSTEM_MESSAGE_TYPES.includes(evt.name)) {
    let aData = null;
    if (evt.name === 'activity') {
      const handler = evt.data.webActivityRequestHandler();
      addWebActivityRequestHandler(handler).then((activityHandlerId) => {
        aData = { source: handler.source, activityHandlerId };
      });

      clients.openWindow('/transfer.html', { disposition: 'inline' }).then((rv) => {
        console.log(`bluetooth activity openWindow success! ${rv}`);

        evt.waitUntil(clients.matchAll({
          includeUncontrolled: true,
          type: 'window'
        }).then((clientList) => {
          console.log('bluetooth ----> send system message');
          clientList.forEach((client) => {
            console.log(client.url);
            client.postMessage({
              category: 'systemmessage',
              type: evt.name,
              data: aData
            });
          });
        }));
      }, (err) => {
        console.error(`bluetooth activity openWindow fail with error: ${err}`);
      });

      const idleTimeExtension = new Promise((resolve) => {
        resolveIdleTimeExtension = resolve;
      });
      evt.waitUntil(idleTimeExtension);
    } else if (evt.name === 'bluetooth-pairing-request') {
      // eslint-disable-next-line max-len
      evt.waitUntil(clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
      }).then((clientList) => {
        console.log(`bluetooth clientList len: ${clientList.length}`);
        let isPairingWindowOpened = false;
        for (let i = 0; i < clientList.length; i++) {
          console.log(`bluetooth ${clientList[i].url}`);
          if (clientList[i].url.indexOf('onpair') > 0) {
            console.log('bluetooth pairing window has opened.');
            isPairingWindowOpened = true;
          }
        }
        if (!isPairingWindowOpened) {
          clients.openWindow('/onpair.html', { disposition: 'attention' }).then((rv) => {
            console.log(`bluetooth pairing openWindow success! ${rv}`);
          }, (err) => {
            console.log(`bluetooth pairing openWindow fail with error: ${err}`);
          });
        }
      }));
    } else if (evt.name === 'bluetooth-pairing-aborted') {
      l10n.once(() => {
        const failedMsg = l10n.get('paired-failed', { 'deviceName': evt.data.json().message });
        const data = {
          text: failedMsg,
          timeout: 2000
        };
        const activity = new WebActivity('show-toast', data);
        activity.start().then(() => {
          console.log('open show toast activity successful.');
        },
        (err) => {
          console.log(`bluetooth show toast with error: ${err}`);
        });
      });
    }
  }
};

self.onmessage = (event) => {
  // Message received from clients
  console.log('bluetooth service worker receive message: ', event.data);
  const { data } = event;
  if (data.isDummy) {
    return;
  }
  if (data.activityHandlerId) {
    const handler = handlerMap[data.activityHandlerId];
    if (data.isError) {
      handler.postError(data.activityResult);
    } else {
      handler.postResult(data.activityResult);
    }
    removeWebActivityRequestHandler(data.activityHandlerId);
  }
  if (resolveIdleTimeExtension) {
    resolveIdleTimeExtension();
    resolveIdleTimeExtension = null;
  }
};


