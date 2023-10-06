'use strict';

/**
 * notify the verification mail has beent sent
 */
var FxaModuleSendSuccess = (function() {

  var Module = Object.create(FxaModule);
  Module.init = function init(options) {
    options = options || {};

    var hasBeenSentMail = $('fxa-send-success').querySelector('#mailaddress');
    hasBeenSentMail.textContent = options.email;
  };

  return Module;

}());

