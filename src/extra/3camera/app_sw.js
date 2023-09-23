self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
let handler = null;
let resolveIdleTimeExtension = null;
self.onsystemmessage = (evt) => {
  console.log('onsystemmessage', evt.name);
  if (evt.name === 'activity') {
    handler = evt.data.webActivityRequestHandler();
    evt.waitUntil(
      clients.openWindow('/index.html#activity', //eslint-disable-line
        { disposition: 'inline' }).then((rv) => {
        console.log('openWindow success!---', rv);
        rv.postMessage({
          source: handler.source
        });
      }, (err) => {
        console.log(`openWindow fail with error: ${err}`);
      }));
    // IdleTimeExtension to make service worker timeout longer
    const idleTimeExtension = new Promise((resolve) => {
      resolveIdleTimeExtension = resolve;
    });
    evt.waitUntil(idleTimeExtension);
  }
};

self.addEventListener('message', (event) => {
  // Message received from clients
  console.log('service worker receive message: ', event.data);
  const { data } = event;
  if (data.isDummy) {
    return;
  }
  if (handler) {
    if (data.isError) {
      handler.postError(data.activityResult);
    } else {
      handler.postResult(data.activityResult);
    }
  }
  if (resolveIdleTimeExtension) {
    resolveIdleTimeExtension();
    resolveIdleTimeExtension = null;
  }
});
