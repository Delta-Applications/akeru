/* -*- Mode: js; js-indent-level: 2; indent-tabs-mode: nil -*- */
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */



/**
 * Singleton object (base object) that handle listener and events on mozIcc
 * objects in order to handle telephony-related menu items in the root panel.
 */
var TelephonySettingHelper = (function(window, document, undefined) {
  var _iccManager;
  var _mobileConnections;

  var _iccId;

  /**
   * Init function.
   */
  function tsh_init() {
    return new Promise(function(resolve, reject) {
      _iccManager = window.navigator.mozIccManager;
      _mobileConnections = window.navigator.mozMobileConnections;
      if (!_mobileConnections || !_iccManager) {
        return resolve();
      }

      navigator.mozL10n.once(function load() {
        DsdsSettings.init();

        TelephonyItemsHandler.init();
        TelephonyItemsHandler.handleItems();

        if (_mobileConnections.length > 1) {
          [].forEach.call(_mobileConnections, (simcard, cardIndex) => {
            tsh_addListeners(cardIndex);
          });
        } else {
          tsh_addListeners(0);
        }

        resolve();
      });
    });
  }

  /**
   * Add listeners.
   */
  function tsh_addListeners(cardIndex) {
    _imsHandler = _mobileConnections[cardIndex].imsHandler;
    if (_imsHandler) {
      _imsHandler.addEventListener('capabilitychange',
        TelephonyItemsHandler.handleItems);
    }

    _mobileConnections[cardIndex].addEventListener('datachange',
      TelephonyItemsHandler.handleItems);
    _iccId = _mobileConnections[cardIndex].iccId;

    var iccCard = _iccManager.getIccById(_iccId);
    if (!iccCard) {
      return;
    }

    iccCard.addEventListener('cardstatechange',
      TelephonyItemsHandler.handleItems);

    _iccManager.addEventListener('iccdetected',
      function iccDetectedHandler(evt) {
        if (_mobileConnections[cardIndex].iccId &&
            (_mobileConnections[cardIndex].iccId === evt.iccId)) {
          TelephonyItemsHandler.handleItems();
          tsh_addListeners(cardIndex);
        }
      }
    );

    _iccManager.addEventListener('iccundetected',
      function iccUndetectedHandler(evt) {
        if (_iccId === evt.iccId) {
          _mobileConnections[cardIndex].removeEventListener('datachange',
            TelephonyItemsHandler.handleItems);
        }
      }
    );
  }

  // Public API.
  return {
    init: tsh_init
  };
})(this, document);
