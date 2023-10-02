

var Toaster = (function() {
  let port = null;
  function postMessage(options) {
    if (!port) {
      console.log('systoaster iac port is null');
      return;
    }
    const _ = navigator.mozL10n.get;
    if (options.messageL10nId && !options.message) {
      options.message = _(options.messageL10nId, options.messageL10nArgs) || options.messageL10nId;
      options.messageL10nId = null;
      options.messageL10nArgs = null;
    }
    if (options.titleL10nId && !options.title) {
      options.title = _(options.titleL10nId, options.titleL10nArgs) || options.titleL10nId;
      options.titleL10nId = null;
      options.titleL10nArgs = null;
    }
    port.postMessage(options);
  }

  function initPort() {
    return new Promise((resolve) => {
      if (!port) {
        navigator.mozApps.getSelf().onsuccess = (evt) => {
          const app = evt.target.result;
          app.connect('systoaster', {
            // We don't want any app receive our IAC message except system app.
            manifestURLs: ['app://system.gaiamobile.org/manifest.webapp']
          }).then((ports) => {
            port = ports[0];
            resolve();
          }, (reason) => {
            console.log('system-toaster is rejected:' + reason);
            resolve();
          });
        };
      } else {
        resolve();
      }
    });
  }

  function init() {
    if (document.readyState !== 'complete') {
      document.addEventListener('readystatechange', function readyStateChange() {
        document.removeEventListener('readystatechange', readyStateChange);
        initPort();
      });
    } else {
      initPort();
    }
  }

  function showToast(options) {
    if (!port) {
      initPort().then(() => {
        postMessage(options);
      })
    } else {
      postMessage(options);
    }
  }
  init();
  return {
    showToast: showToast
  };
})();
