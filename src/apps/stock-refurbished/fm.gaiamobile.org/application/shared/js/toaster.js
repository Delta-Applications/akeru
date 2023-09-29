'use strict';
var Toaster = {
  showToast: function t_showToast(options) {
    navigator.mozApps.getSelf().onsuccess = function (evt) {
      var app = evt.target.result;
      app.connect('systoaster').then(function onConnAccepted(ports) {
        if (options.messageL10nId && !options.message) {
          options.message = navigator.mozL10n.get(options.messageL10nId, options.messageL10nArgs);
          options.messageL10nId = null;
          options.messageL10nArgs = null;
        }
        if (options.titleL10nId && !options.title) {
          options.title = navigator.mozL10n.get(options.titleL10nId, options.titleL10nArgs);
          options.titleL10nId = null;
          options.titleL10nArgs = null;
        }
        ports.forEach(function (port) {
          port.postMessage(options);
        });
      }, function onConnRejected(reason) {
        console.log('system-toaster is rejected:' + reason);
      });
    }
  }
};
