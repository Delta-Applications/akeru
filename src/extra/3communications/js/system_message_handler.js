/**
 * @file Operate the service worker msg
 */ 

(function () {
  let msgSet = [];
  let ready = false;

  window.addEventListener('calllogRenderComplete', () => {
    ready = true;
    if (msgSet.length > 0) {
      msgSet.forEach(item => {
        sendSysMsg(item);
      });

      msgSet = [];
    }
  });

  // send system msg
  const sendSysMsg = (evt) => {
    const event = new CustomEvent(evt.data.type, {
      detail: { data: evt.data.data || null }
    });
    window.dispatchEvent(event);

    // If is activity msg keep sw alive
    if (evt.data === 'pick') {
      setInterval(() => {
        if (window.serviceWorker.controller) {
          window.serviceWorker.controller.postMessage(
            { name: 'keepAlive' }
          );
        }
      }, 29000);
    }
  }

  if (navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', (evt) => {
      if (ready) {
        sendSysMsg(evt);
      } else {
        msgSet.push(evt);
      }
    });
  }
})();
